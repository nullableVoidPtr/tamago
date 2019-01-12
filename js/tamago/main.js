import config from "./config.js";
import Tamagotchi, {ACCESS_READ, ACCESS_WRITE} from "./cpu/tamagotchi.js";
import disassemble from "./cpu/disassembler.js";
import ports from "./data/ports.js";

function toHex(w, i) {
	i = i.toString(16).toUpperCase();

	var zeros = "0";
	while (zeros.length < w) { zeros += zeros; }

	return zeros.substr(0, w).substr(i.length) + i;
}

window.customElements.define('tamago-display', class TamagoDisplay extends HTMLElement {
	constructor() {
		super();

		this.attachShadow({ mode: 'open' });
		var style = document.createElement("style");
		/*
		 *  License
		 *  ------------------------------------------------------------------------------
		 *  - The Font Awesome font is licensed under SIL OFL 1.1 -
		 *    http://scripts.sil.org/OFL
		 *  - Font Awesome CSS, LESS, and SASS files are licensed under MIT License -
		 *    http://opensource.org/licenses/mit-license.html
		 *  - Font Awesome documentation licensed under CC BY 3.0 -
		 *    http://creativecommons.org/licenses/by/3.0/
		 *  - Attribution is no longer required in Font Awesome 3.0, but much appreciated:
		 *    "Font Awesome by Dave Gandy - http://fontawesome.io"
		 *
		 */
		style.textContent = `
			* {
				text-align: center;
			}

			[class^="icon-"],
			[class*=" icon-"] {
				font-family: FontAwesome;
				font-weight: normal;
				font-style: normal;
				text-decoration: inherit;
				-webkit-font-smoothing: antialiased;
				*margin-right: .3em;
			}
			[class^="icon-"]:before,
			[class*=" icon-"]:before {
				text-decoration: inherit;
				display: inline-block;
				speak: none;
			}

			.icon-dashboard:before {
				content: "\\f0e4";
			}

			.icon-food:before {
				content: "\\f0f5";
			}

			.icon-trash:before {
				content: "\\f014";
			}

			.icon-globe:before {
				content: "\\f0ac";
			}

			.icon-user:before {
				content: "\\f007";
			}

			.icon-comments:before {
				content: "\\f086";
			}

			.icon-medkit:before {
				content: "\\f0fa";
			}

			.icon-heart:before {
				content: "\\f004";
			}

			.icon-book:before {
				content: "\\f02d";
			}

			.icon-bell:before {
				content: "\\f0a2";
			}

			canvas {
				border: 2px solid var(--pink);
				display: inline-block;
				background: var(--light-grey);
				width: 192px;
				height: 124px;
			}
		`;
		this.shadowRoot.appendChild(style);
		
		this.figureDiv = document.createElement("div");
		this.figureDiv.classList.add('figure');
		this.shadowRoot.appendChild(this.figureDiv);

		this.glyphs = [];
		
		var topIcons = document.createElement("div");
		for (var icon of ["icon-dashboard", "icon-food", "icon-trash", "icon-globe", "icon-user"]) {
			var i = document.createElement("i");
			i.classList.add("icon");
			i.classList.add(icon);
			i.classList.add("glyph");
			topIcons.appendChild(i);
			this.glyphs.push(i);
		}
		this.shadowRoot.appendChild(topIcons);

		this.canvas = document.createElement("canvas");
		this.canvasContext = this.canvas.getContext('2d');
		this.canvas.width = 48;
		this.canvas.height = 31;
		this.shadowRoot.appendChild(this.canvas);
		this.pixelBuffer = this.canvasContext.getImageData(0,0,64,31);
		this.pixels = new Uint32Array(this.pixelBuffer.data.buffer);

		var bottomIcons = document.createElement("div");
		for (var icon of ["icon-comments", "icon-medkit", "icon-heart", "icon-book", "icon-bell"]) {
			var i = document.createElement("i");
			i.classList.add("icon");
			i.classList.add(icon);
			i.classList.add("glyph");
			bottomIcons.appendChild(i);
			this.glyphs.push(i);
		}
		this.shadowRoot.appendChild(bottomIcons);
	}
	
	refresh() {
		this.canvasContext.putImageData(this.pixelBuffer, 0, 0);
	}

	set figure(f) {
		this.figureDiv.innerText = `${f.name} inserted`;
	}
});

window.customElements.define('hex-dump', class HexDump extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: 'open'});
		var style = document.createElement("style");
		style.textContent = `
			table {
				border-collapse: collapse;
			}
			tr:nth-child(even) {
				background: white;
			}
			
			tr:nth-child(odd) {
				background: var(--light-grey);
			}
			
			th {
				font-weight: normal;
			}
			
			th, td {
				padding: 0;
				font-style: italic;
			}
			
			td:nth-child(even) {
				color: var(--blue-2);
			}
			
			td:nth-child(odd) {
				color: var(--blue);
			}
			
			td.read {
				background: var(--red-2);
				color: white;
			}
			
			td.write {
				background: var(--green-2);
				color: white;
			}
			
			td.read.write {
				background: var(--yellow-2);
				color: white;
			}
		`;
		this.shadowRoot.appendChild(style);
	}

	connectedCallback() {
		if (!this.hasAttribute('row-length'))
			this.setAttribute('row-length', 16);
		if (!this.hasAttribute('byte-length'))
			this.setAttribute('byte-length', 0);
		this.createTable();
	}

	createTable() {
		this.bytes = [];
		if (this.shadowRoot.querySelector("table")) {
			this.shadowRoot.removeChild(this.shadowRoot.querySelector("table"));
		}
		var table = document.createElement("table");
		this.shadowRoot.appendChild(table);
		var i = 0;
		while (i < this.byteLength) {
			if (i % this.rowLength == 0) {
				var row = document.createElement("tr");
				var offset = document.createElement("th");
				offset.innerText = toHex(4, this.offset + i);
				row.appendChild(offset);
				table.appendChild(row);
			}
			var cell = document.createElement("td");
			cell.innerText = "00";
			cell.addEventListener("click", this.onByteClick.bind(this));
			cell.setAttribute("data-address", this.offset + i);
			row.appendChild(cell);
			this.bytes.push(cell);
			i++;
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		this.setAttribute(name, newValue);
		this.createTable();
	}

	onByteClick(e) {
		if (this.byteCallback) {
			this.byteCallback(e);
		}
	}

	set byteLength(value) {
		this.setAttribute('byte-length', value);
    }

	get byteLength() {
		return Number(this.getAttribute('byte-length'));
    }

	set rowLength(value) {
		this.setAttribute('row-length', value);
    }

	get rowLength() {
		return Number(this.getAttribute('row-length'));
    }

	set offset(value) {
		this.setAttribute('offset', value);
    }

	get offset() {
		return Number(this.getAttribute('offset')) || 0;
    }
});

window.customElements.define('disassembly-listing', class Disassembly extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: 'open'});
		debugger;
		var style = document.createElement("style");
		style.textContent = `
			table {
				min-width: 80ex;
				border-collapse: collapse;
			}
			
			tr {
				height: 1ex;
			}
			
			tr:nth-child(even) {
				background: white;
			}
			
			tr:nth-child(odd) {
				background: var(--light-grey);
			}

			tr.active {
				background: var(--yellow);
			}
		`;
		this.shadowRoot.appendChild(style);
	}

	connectedCallback() {
		if (!this.hasAttribute('instruction-count'))
			this.setAttribute('instruction-count', 55);
		this.createTable();
	}

	createTable() {
		this.bytes = [];
		if (this.shadowRoot.querySelector("table")) {
			this.shadowRoot.removeChild(this.shadowRoot.querySelector("table"));
		}
		var table = document.createElement("table");
		this.shadowRoot.appendChild(table);
		var colgroup = document.createElement("colgroup");
		table.appendChild(colgroup);
		var addressCol = document.createElement("col");
		addressCol.style = "color: var(--bright-orange); width: 4ex";
		colgroup.appendChild(addressCol);
		var opcodeCol = document.createElement("col");
		opcodeCol.style = "color: var(--blue-green-2); width: 3ex";
		colgroup.appendChild(opcodeCol);
		var operandCol = document.createElement("col");
		operandCol.style = "color: var(--purple); width: 16ex";
		colgroup.appendChild(operandCol);
		var hexCol = document.createElement("col");
		hexCol.style = "color: var(--purple); width: 16ex";
		colgroup.appendChild(hexCol);
		var commentCol = document.createElement("col");
		commentCol.style = "color: var(--green-2)";
		colgroup.appendChild(commentCol);
		
		for (var i = 0; i < config.instructionCount; i++ ) {
			var instruction = document.createElement("tr");
			instruction.appendChild(document.createElement("td"));
			instruction.appendChild(document.createElement("td"));
			var instructionAddressing = document.createElement("td");
			instruction.appendChild(document.createElement("td"));
			table.appendChild(instruction);
		}
	}
	
	set instructionCount(value) {
		this.setAttribute('instruction-count', value);
    }

	get instructionCount() {
		return Number(this.getAttribute('instruction-count')) || 0;
    }
});

class Tamago {
	constructor(element, bios) {
		var that = this;

		this.system = new Tamagotchi(bios);

		this.configure(element);

		this._disasmOffset = 0;

		this.refresh();

		this.mapping = { 65: 1, 83: 2, 68: 4, 82: 8 };

		document.addEventListener("keydown", e => that.system.keys &= ~that.mapping[e.keyCode] || 0xFF);

		document.addEventListener("keyup", e => that.system.keys |= that.mapping[e.keyCode] || 0);
	}

	step(e) {
		this.system.step();
		this.refresh();
	}

	irq(e) {
		this.system.fire_irq(parseInt(this.body.selects.irq.value,10));
		this.refresh();
	}

	nmi(e) {
		this.system.fire_nmi(6);
		this.refresh();
	}

	run(e) {
		var that = this;

		function frame() {
			if (!that.running) { return ; }

			that.system.step_realtime();
			that.refresh();
			requestAnimationFrame(frame);
		}

		this.running = !this.running;
		frame();

		if (e) { e.target.attributes.value.value = this.running ? "stop" : "run"; }
	}

	reset(e) {
		this.system.reset();
		this.refresh();
	}

	refresh_simple() {
		var a = 4, b = 0, g = 0;

		while (g < 10) {
			var glyph = (this.system._dram[a] >> b) & 3;
			if ((b -= 2) < 0) { b = 6; a++; }

			this.display.glyphs[g++].style.color = "#" + (this.system.PALETTE[glyph] & 0xFFFFFF).toString(16);
		}

		var px = 0;
		for (var y = 0; y < 31; y++) {
			var a = this.system.LCD_ORDER[y];

			for (var x = 0; x < 64; x += 4) {
				var d = this.system._dram[a++], b = 6;

				while (b >= 0) {
					this.display.pixels[px++] = this.system.PALETTE[(d >> b) & 3];
					b -= 2;
				}
			}
		}

		this.display.refresh();
	}

	drop(evt) {
		evt.stopPropagation();
		evt.preventDefault();

		var files = evt.dataTransfer.files,
			binary = files[0],
			that = this;

		if (files.length < 0) { return ; }

		this.display.figure = binary;

		var reader = new FileReader();
		reader.onload = e => that.system.insert_figure(e.target.results);
		reader.readAsArrayBuffer(binary);
	};

	update_control(e) {
		if (e) {
			this._debug_port = parseInt(e.target.dataset.address);
		}

		var port = ports[this._debug_port];
		if (!port) {
			port = {
				name: "Unknown",
				description: "",
			}
		}
		if (!port.fields) {
			port.fields = [{ name:"data", start: 0, length: 8 }];
		}

		port = Object.create(port);
		port.address = this._debug_port.toString(16);

		if (port.address.length < 2) port.address = "0" + port.address;

		while (this.body.port.firstChild) {
			this.body.port.removeChild(this.body.port.firstChild);
		}

		var header = document.createElement("h1");
		header.innerText = `${port.name} (0x${port.address})`
		this.body.port.appendChild(header);

		for (var f of port.fields) {
			var field = document.createElement("field");
			field.setAttribute("name", f.name);
			field.setAttribute("data-start", f.start);
			field.setAttribute("data-length", f.length);
			var range = document.createElement("range");
			range.innerText = `[${f.start}${(f.length > 1) ? ':' + (f.length + f.start - 1) : ""}]`;
			field.appendChild(range);
			field.appendChild(document.createElement("hex"));
			field.appendChild(document.createElement("bin"));
			this.body.port.appendChild(field);
		}

		this.body.fields = this.body.port.querySelectorAll("field");

		this.refresh_port();
	}

	refresh_port() {
		var d = this.system.read(this._debug_port, true);

		function pad(s, l) {
			return "00000000".substr(0, l).substr(s.length) + s;
		}

		for (var f of this.body.fields) {
			var l = Number(f.dataset.length),
				s = Number(f.dataset.start),
				m = (d >> s) & ((1 << l) - 1),
				b = f.querySelector("bin"),
				h = f.querySelector("hex");

			b.innerHTML = pad(m.toString(2), l);
			h.innerHTML = pad(m.toString(16), Math.ceil(l / 4));
		}
	}

	refresh_debugger() {

		// Update basic views
		for (const [register, elem] of Object.entries(this.body.registers)){
			elem.innerHTML = toHex(2, this.system[register]);
		}

		for (const [flag, elem] of Object.entries(this.body.flags)) {
			elem.classList.toggle("active", Boolean(this.system[flag]));
		}

		for (const [i, m] of Object.entries(this.memory.bytes)) {
			m.innerHTML = toHex(2, this.system._wram[i]);
		}

		for (const [i, m] of Object.entries(this.control.bytes)) {
			var acc = this.system._cpuacc[i+0x3000];
			this.system._cpuacc[i+0x3000] = 0;
			m.classList.toggle('read', acc & ACCESS_READ);
			m.classList.toggle('write', acc & ACCESS_WRITE);
			m.innerHTML = toHex(2, this.system._cpureg[i]);
		}

		var disasm = disassemble(config.instructionCount, this._disasmOffset, this.system),
			bias = Math.floor(config.instructionCount / 2),
			current = disasm.reduce(function(acc, d, i){ return d.active ? i : acc; }, null);

		// PC isn't were it should be
		if (current === null) {
			this._disasmOffset = this.system.pc;
			disasm = disassemble(config.instructionCount, this._disasmOffset, this.system);
		} else if (current >= bias && disasm.length == config.instructionCount) {
			this._disasmOffset = disasm[current-bias].location;
			disasm = disassemble(config.instructionCount, this._disasmOffset, this.system);
		}

		for (const [i, g] of Object.entries(disasm)) {
			var row = this.body.instructions[i];

			row.location.innerHTML = toHex(4, g.location)
			row.opcode.innerHTML = g.instruction;
			row.addressing.innerHTML = ((g.data === null) ? "" : g.data).toString(16).toUpperCase();
			row.data.innerHTML = g.bytes;

			function attr(node, attr, value) {
				if(value !== undefined) { node.setAttribute(attr, value) }
				else node.removeAttribute(attr);
			}

			row.instruction.classList.toggle("active", g.active === true);
			attr(row.addressing, 'mode', g.mode);
			attr(row.addressing, 'address', (g.address || 0).toString(16).toUpperCase());
			attr(row.instruction, 'port', g.port);
		}

		for (var row of this.body.instructions.slice(disasm.length)) {
			row.location.innerHTML = "";
			row.opcode.innerHTML = "";
			row.addressing.innerHTML = "";
			row.data.innerHTML = "";
			row.addressing.removeAttribute('mode');
		}

		this.refresh_port();
		this.refresh_simple();
	}

	configure(element) {

		var debug = Boolean(element.attributes.debugger);

		var column = document.createElement("div");
		this.display = document.createElement("tamago-display");

		column.appendChild(this.display);

		if (debug) {
			var debuggerButtons = document.createElement("buttons");
			for (var debugAction of ["step", "run", "reset", "nmi"]) {
				var button = document.createElement("input");
				button.type = "button";
				button.value = debugAction;
				button.setAttribute("action", debugAction);
				debuggerButtons.appendChild(button);
			}

			column.appendChild(debuggerButtons);

			var irqForm = document.createElement("buttons");

			var figureSelect = document.createElement("select");
			figureSelect.setAttribute("action", "figure");
			for (const [value, text] of Object.entries(["No Figure", "Fig1", "Fig2", "Fig3"])) {
				var option = document.createElement("option");
				option.value = value;
				option.innerText = text;
				figureSelect.appendChild(option);
			}
			irqForm.appendChild(figureSelect)

			var irqSelect = document.createElement("select");
			irqSelect.setAttribute("action", "irq");
			for (const [value, text] of Object.entries(["TIM0",,, "2048", "8192", "SPU", "FPI", "FP",,, "TIM1", "TBH", "TBL"])) {
				var option = document.createElement("option");
				option.value = value;
				option.innerText = `${value}: ${text}`;
				irqSelect.appendChild(option);
			}
			irqForm.appendChild(irqSelect);

			var irqButton = document.createElement("input");
			irqButton.type = "button";
			irqButton.value = "irq";
			irqButton.setAttribute("action", "irq");
			irqForm.appendChild(irqButton);

			column.appendChild(irqForm);

			var cpu = document.createElement("cpu");

			var flags = document.createElement("flags");
			for (var name of ["C", "Z", "I", "D", "V", "N"]) {
				var flag = document.createElement("flag");
				flag.setAttribute("name", name);
				flags.appendChild(flag);
			}
			cpu.appendChild(flags);

			var registers = document.createElement("registers");
			for (var name of ["A", "X", "Y", "S", "PC"]) {
				var register = document.createElement("register");
				register.setAttribute("name", name);
				registers.appendChild(register);
			}
			cpu.appendChild(registers);

			column.appendChild(cpu);

			this.control = document.createElement("hex-dump");
			this.control.offset = 0x3000;
			this.control.byteLength = this.system._cpureg.length;
			this.control.rowLength = config.registerBytesPerLine;
			this.control.byteCallback = this.update_control.bind(this);
			this.control.classList.add("control");
			column.appendChild(this.control);
		}

		element.appendChild(column);
		if (debug) {
			column = document.createElement("div");
			var disassembly = document.createElement("disassembly");
			for (var i = 0; i < config.instructionCount; i++ ) {
				var instruction = document.createElement("instruction");
				instruction.setAttribute("port", "");
				instruction.appendChild(document.createElement("location"));
				instruction.appendChild(document.createElement("opcode"));
				var instructionAddressing = document.createElement("addressing");
				instructionAddressing.setAttribute("mode", "");
				instructionAddressing.setAttribute("address", "");
				instruction.appendChild(instructionAddressing);
				instruction.appendChild(document.createElement("data"));
				disassembly.appendChild(instruction);
			}
			column.appendChild(disassembly);
			element.appendChild(column);

			column = document.createElement("div");
			column.appendChild(document.createElement("port"));

			this.memory = document.createElement("hex-dump");
			this.memory.rowLength = config.memoryBytesPerLine;
			this.memory.byteLength = this.system._wram.length;
			this.memory.classList.add("memory");
			column.appendChild(this.memory);
			element.appendChild(column);
		}

		function noopHandler(evt) {
			evt.stopPropagation();
			evt.preventDefault();
		}

		element.addEventListener("dragenter", noopHandler, false);
		element.addEventListener("dragexit", noopHandler, false);
		element.addEventListener("dragover", noopHandler, false);
		element.addEventListener("drop", this.drop.bind(this), false);

		// Bind to HTML
		if (debug) {
			for (var el of document.querySelectorAll("input[type=button]")) {
				el.addEventListener("click", this[el.attributes.action.value].bind(this))
			}

			this.body = {
				port: element.querySelector("port"),
				selects: [...element.querySelectorAll("select")].reduce((acc, s) => {
					acc[s.attributes.action.value.toLowerCase()] = s;
					return acc;
				}, {}),
				flags: [...element.querySelectorAll("flag")].reduce((acc, f) => {
					acc[f.attributes.name.value.toLowerCase()] = f;
					return acc;
				}, {}),
				registers: [...element.querySelectorAll("register")].reduce((acc, r) => {
					acc[r.attributes.name.value.toLowerCase()] = r;
					return acc;
				}, {}),
				instructions: [...element.querySelectorAll("instruction")].map(i => (
					{
						instruction: i,
						location: i.querySelector("location"),
						opcode: i.querySelector("opcode"),
						data: i.querySelector("data"),
						addressing: i.querySelector("addressing"),
					}
				))
			}

			document.querySelector("select[action=figure]").addEventListener("change", function(e) {
				this.system.inserted_figure = Number(e.target.value);
			});

			this._debug_port = 0x3000;
			this.update_control();

			this.refresh = this.refresh_debugger;
		} else {
			this.refresh = this.refresh_simple;
			// Start running soon
			setTimeout(function() { this.run(); }, 10);
		}
	};
}

fetch("files/tamago.bin").then(response => {
	if (!response.ok) {
		throw new Error("HTTP error, status = " + response.status);
	}
	return response.arrayBuffer();
}).then(bios => {
	// Start the application when BIOS is done
	for (var elem of document.querySelectorAll("tamago")) {
		new Tamago(elem, bios);
	}
});
