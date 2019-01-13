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
			:host {
				text-align: center;
				display: block;
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
		this.palette = [0xffdddddd, 0xff9e9e9e, 0xff606060, 0xff222222];
	}
	
	connectedCallback() {
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
	
	refresh(system) {
		var a = 4, b = 0;

		for (var g of this.glyphs) {
			var glyph = (system._dram[a] >> b) & 3;
			if ((b -= 2) < 0) { b = 6; a++; }

			g.style.color = "#" + (this.palette[glyph] & 0xFFFFFF).toString(16);
		}

		var px = 0;
		for (var y = 0; y < 31; y++) {
			var a = system.LCD_ORDER[y];

			for (var x = 0; x < 64; x += 4) {
				var d = system._dram[a++], b = 6;

				while (b >= 0) {
					this.pixels[px++] = this.palette[(d >> b) & 3];
					b -= 2;
				}
			}
		}

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
		for (var i = 0; i < this.byteLength; i++) {
			if (i % this.rowLength == 0) {
				var row = document.createElement("tr");
				var offset = document.createElement("th");
				offset.innerText = toHex(4, this.virtualOffset + i);
				row.appendChild(offset);
				table.appendChild(row);
			}
			var cell = document.createElement("td");
			cell.innerText = "00";
			cell.addEventListener("click", this.onByteClick.bind(this));
			cell.setAttribute("data-address", this.virtualOffset + i);
			row.appendChild(cell);
			this.bytes.push(cell);
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		this.setAttribute(name, newValue);
		this.createTable();
	}
	
	update(memory, access) {
		for (var i = 0; i < this.bytes.length; i++) {
			var cell = this.bytes[i];
			if (access) {
				var acc = access[i+this.virtualOffset];
				access[i+this.virtualOffset] = 0;
				cell.classList.toggle('read', acc & ACCESS_READ);
				cell.classList.toggle('write', acc & ACCESS_WRITE);
			}
			cell.innerHTML = toHex(2, memory[i]);
		}
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

	set virtualOffset(value) {
		this.setAttribute('virtual-offset', value);
    }

	get virtualOffset() {
		return Number(this.getAttribute('virtual-offset')) || 0;
    }
});

window.customElements.define('disassembly-listing', class Disassembly extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: 'open'});
		var style = document.createElement("style");
		style.textContent = `
			table {
				min-width: 80ex;
				border-collapse: collapse;
			}

			colgroup {
				display: table-column-group;
			}

			tr {
				height: 1em;
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

			td {
				padding-left: 1ex;
			}

			td:nth-child(1) {
				color: var(--bright-orange);
				width: 4ex;
			}

			td:nth-child(2) {
				color: var(--blue-green-2);
				width: 3ex;
			}
			td:nth-child(3) {
				color: var(--purple);
				width: 16ex;
			}
			
			td:nth-child(3)[mode=absolute]:before,
			td:nth-child(3)[mode=absoluteX]:before,
			td:nth-child(3)[mode=absoluteY]:before,
			td:nth-child(3)[mode=zeropage]:before,
			td:nth-child(3)[mode=zeropageX]:before,
			td:nth-child(3)[mode=zeropageY]:before {
				content: "$";
			}
			td:nth-child(3)[mode=indirect]::before,
			td:nth-child(3)[mode=indirectX]::before,
			td:nth-child(3)[mode=indirectY]::before {
				content: "(";
			}
			td:nth-child(3)[mode=indirect]:after {
				content: ")";
			}
			td:nth-child(3)[mode=relative]:after {
				content: " ;" attr(address);
			}
			td:nth-child(3)[mode=indirectX]:after {
				content: ", X)";
			}
			td:nth-child(3)[mode=indirectY]:after {
				content: ", Y)";
			}
			td:nth-child(3)[mode=zeropageX]:after,
			td:nth-child(3)[mode=absoluteX]:after {
				content: ", X";
			}
			td:nth-child(3)[mode=zeropageY]:after,
			td:nth-child(3)[mode=absoluteY]:after {
				content: ", Y";
			}

			td:nth-child(4) {
				color: var(--purple);
				width: 16ex;
			}

			td:nth-child(5) {
				color: var(--green-2);
			}
			td:nth-child(5):not(:empty):before {
				color: var(--green-2);
				content: "; ";
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

		this.instructions = [];
		for (var i = 0; i < this.instructionCount; i++ ) {
			var instruction = document.createElement("tr");
			for (var [name, cell]of Object.entries({
				address: document.createElement("td"),
				opcode: document.createElement("td"),
				operand: document.createElement("td"),
				hex: document.createElement("td"),
				comment: document.createElement("td"),
			})) {
				instruction.appendChild(cell);
				instruction[name] = cell;
			}
			this.instructions.push(instruction);
			table.appendChild(instruction);
		}
	}

	update(system, offset) {
		var disasm = disassemble(config.instructionCount, offset, system);
		for (const [i, g] of Object.entries(disasm)) {
			var instruction = this.instructions[i];
			instruction.address.innerHTML = toHex(4, g.location)
			instruction.opcode.innerHTML = g.instruction;
			instruction.operand.innerHTML = ((g.data === null) ? "" : g.data).toString(16).toUpperCase();
			instruction.hex.innerHTML = g.bytes;
			instruction.comment.innerHTML = g.port || "";
			instruction.classList.toggle("active", g.active === true);

			function attr(node, attr, value) {
				if(value !== undefined) { node.setAttribute(attr, value) }
				else node.removeAttribute(attr);
			}
			attr(instruction.operand, 'mode', g.mode);
			attr(instruction.operand, 'address', (g.address || 0).toString(16).toUpperCase());
		}

		for (var instruction of this.instructions.slice(disasm.length)) {
			instruction.address.innerHTML = "";
			instruction.opcode.innerHTML = "";
			instruction.operand.innerHTML = "";
			instruction.hex.innerHTML = "";
			instruction.operand.removeAttribute('mode');
		}
	}

	set instructionCount(value) {
		this.setAttribute('instruction-count', value);
    }

	get instructionCount() {
		return Number(this.getAttribute('instruction-count')) || 0;
    }
});

window.customElements.define('cpu-info', class CPUInfo extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: 'open'});
		var style = document.createElement("style");
		style.textContent = `
			.registers {
				width: 28ex;
				padding: 10px;
			}

			.registers:before {
				content: "Registers";
				display: block;
			}
			
			.register:before {
				display: inline-block;
				text-align: right;
				content: attr(name);
				width: 32px;
				padding: 2px 10px;
			}

			.flags {
				padding: 10px;
				text-align: center;
			}

			.flags:before {
				content: "Flags";
				display: block;
			}

			.flag {
				display: inline-block;
				position: relative;
				min-width: 16px;
				padding: 2px;
			}

			.flag:before {
				text-align: center;
				content: attr(name);
				display: block;
			}
		`;
		this.shadowRoot.appendChild(style);
	}

	connectedCallback() {
		this.flags = {};
		var flagList = document.createElement("div");
		flagList.classList.add("flags");
		for (var f of ["C", "Z", "I", "D", "V", "N"]) {
			var container = document.createElement("span");
			this.flags[f.toLowerCase()] = document.createElement("input");
			container.appendChild(this.flags[f.toLowerCase()])
			this.flags[f.toLowerCase()].type = "checkbox";
			this.flags[f.toLowerCase()].disabled = true;
			container.classList.add("flag");
			container.setAttribute("name", f);
			flagList.appendChild(container);
		}
		this.shadowRoot.appendChild(flagList);

		this.registers = {};
		var registerList = document.createElement("div");
		registerList.classList.add("registers");
		for (var r of ["A", "X", "Y", "S", "PC"]) {
			this.registers[r.toLowerCase()] = document.createElement("span");
			this.registers[r.toLowerCase()].setAttribute("name", r);
			this.registers[r.toLowerCase()].classList.add("register")
			registerList.appendChild(this.registers[r.toLowerCase()]);
		}
		this.shadowRoot.appendChild(registerList);
	}
	
	update(system) {
		for (const [register, elem] of Object.entries(this.registers)){
			elem.innerHTML = toHex(2, system[register]);
		}

		for (const [flag, elem] of Object.entries(this.flags)) {
			elem.checked = Boolean(system[flag]);
		}
	}
});

window.customElements.define('port-info', class PortInfo extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: 'open'});
		var style = document.createElement("style");
		style.textContent = `
			:host {
				display: block;
				overflow: hidden;
			}
			.header {
				font-size: 14px;
				margin: 0;
				width: 100%;
				padding: 1ex 0 1ex;
				font-weight: bold;
				text-decoration: underline;
			}
			.field:before {
				display: inline-block;
				min-width: 18ex;
				content: attr(name);
				font-weight: bold;
			}
			.field .range {
				display: inline-block;
				min-width: 6ex;
			}
			.field .bin {
				min-width: 8ex;
			}
			.field .hex {
				min-width: 2ex;
			}
			.field .bin,
			.field .hex {
				display: inline-block;
				padding: 0 1ex;
			}
			.field:last-child {
				padding-bottom: 1ex;
			}
		`;
		this.shadowRoot.appendChild(style);
	}
	static get observedAttributes() {
		return ['address'];
	}

	connectedCallback() {
		if (!this.hasAttribute('address'))
			this.setAttribute('address', 0x3000);
		this.header = document.createElement("h1");
		this.header.classList.add("header");
		this.shadowRoot.appendChild(this.header);
		this.fieldList = document.createElement("div");
		this.shadowRoot.appendChild(this.fieldList);
		this.update();
	}
	
	attributeChangedCallback() {
		this.update();
	}
	
	update() {
		var p = ports[this.address];
		if (!p) {
			p = {
				name: "Unknown",
				description: "",
			}
		}
		if (!p.fields) {
			p.fields = [{ name:"data", start: 0, length: 8 }];
		}

		p = Object.create(p);
		p.address = this.address.toString(16);

		if (p.address.length < 2) p.address = "0" + p.address;

		this.header.innerText = `${p.name} (0x${p.address})`
		
		while (this.fieldList.firstChild) {
			this.fieldList.removeChild(this.fieldList.firstChild);
		}

		for (var f of p.fields) {
			var field = document.createElement("div");
			field.classList.add("field");
			field.setAttribute("name", f.name);
			field.setAttribute("data-start", f.start);
			field.setAttribute("data-length", f.length);
			var range = document.createElement("span");
			range.classList.add("range");
			range.innerText = `[${f.start}${(f.length > 1) ? ':' + (f.length + f.start - 1) : ""}]`;
			field.appendChild(range);
			field.hexadecimal = document.createElement("span");
			field.hexadecimal.classList.add("hex");
			field.appendChild(field.hexadecimal);
			field.binary = document.createElement("span");
			field.binary.classList.add("bin");
			field.appendChild(field.binary);
			this.fieldList.appendChild(field);
		}

		this.refresh();
	}
	
	refresh() {
		var d = this.system.read(this.address, true);

		function pad(s, l) {
			return "00000000".substr(0, l).substr(s.length) + s;
		}

		for (var f of this.fieldList.children) {
			var l = Number(f.dataset.length),
				s = Number(f.dataset.start),
				m = (d >> s) & ((1 << l) - 1);

			f.binary.innerHTML = pad(m.toString(2), l);
			f.hexadecimal.innerHTML = pad(m.toString(16), Math.ceil(l / 4));
		}
	}
	
	set address(value) {
		this.setAttribute('address', value);
    }

	get address() {
		return Number(this.getAttribute('address')) || 0;
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
		this.display.refresh(this.system);
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

	refresh_debugger() {

		// Update basic views
		this.CPUInfo.update(this.system);

		this.memory.update(this.system._wram);
		
		this.control.update(this.system._cpureg, this.system._cpuacc);
		
		var disasm = disassemble(config.instructionCount, this._disasmOffset, this.system),
			bias = Math.floor(config.instructionCount / 2),
			current = disasm.reduce(function(acc, d, i){ return d.active ? i : acc; }, null);

		// PC isn't were it should be
		if (current === null) {
			this._disasmOffset = this.system.pc;
		} else if (current >= bias && disasm.length == config.instructionCount) {
			this._disasmOffset = disasm[current-bias].location;
		}

		this.disassembly.update(this.system, this._disasmOffset);

		this.portInfo.refresh();
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

			this.CPUInfo = document.createElement("cpu-info");
			column.appendChild(this.CPUInfo);

			this.control = document.createElement("hex-dump");
			this.control.virtualOffset = 0x3000;
			this.control.byteLength = this.system._cpureg.length;
			this.control.rowLength = config.registerBytesPerLine;
			this.control.byteCallback = function(e) {
				this.portInfo.address = parseInt(e.target.dataset.address);
			}.bind(this);
			this.control.classList.add("control");
			column.appendChild(this.control);
		}

		element.appendChild(column);
		if (debug) {
			column = document.createElement("div");
			this.disassembly = document.createElement("disassembly-listing");
			column.appendChild(this.disassembly);
			element.appendChild(column);

			column = document.createElement("div");
			this.portInfo = document.createElement("port-info");
			this.portInfo.system = this.system;
			column.appendChild(this.portInfo);

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
				selects: [...element.querySelectorAll("select")].reduce((acc, s) => {
					acc[s.attributes.action.value.toLowerCase()] = s;
					return acc;
				}, {})
			}

			document.querySelector("select[action=figure]").addEventListener("change", function(e) {
				this.system.inserted_figure = Number(e.target.value);
			}.bind(this));

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
