import config from "./config.js";
import Tamagotchi, {ACCESS_READ, ACCESS_WRITE} from "./cpu/tamagotchi.js";
import disassemble from "./cpu/disassembler.js";
import ports from "./data/ports.js";

function getBinary(path, cb) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", path, true);
	xhr.responseType = "arraybuffer";
	xhr.send();

	xhr.onreadystatechange = function () {
		if (xhr.readyState !== 4) {
			return ;
		}

		if (xhr.status !== 200) {
			throw new Error("Could not download " + path);
		}

		cb(xhr.response);
	};
}

function toHex(w, i) {
	i = i.toString(16).toUpperCase();

	var zeros = "0";
	while (zeros.length < w) { zeros += zeros; }

	return zeros.substr(0, w).substr(i.length) + i;
}

class Tamago {
	constructor(element, bios) {
		var that = this;

		this.system = new Tamagotchi(bios);

		this.configure(element);

		this._pixeldata = this.body.display.getImageData(0,0,64,31);
		this._pixels = new Uint32Array(this._pixeldata.data.buffer);
		this._disasmOffset = 0;

		this.refresh();

		this.mapping = { 65: 1, 83: 2, 68: 4, 82: 8 };

		document.addEventListener("keyup", function (e) {
			that.system.keys |= that.mapping[e.keyCode] || 0;
		});
		document.addEventListener("keydown", function (e) {
			that.system.keys &= ~that.mapping[e.keyCode] || 0xFF;
		});
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

			this.body.glyphs[g++].style.color = "#" + (this.system.PALETTE[glyph] & 0xFFFFFF).toString(16);
		}

		var px = 0;
		for (var y = 0; y < 31; y++) {
			var a = this.system.LCD_ORDER[y];

			for (var x = 0; x < 64; x += 4) {
				var d = this.system._dram[a++], b = 6;

				while (b >= 0) {
					this._pixels[px++] = this.system.PALETTE[(d >> b) & 3];
					b -= 2;
				}
			}
		}

		this.body.display.putImageData(this._pixeldata, 0, 0);
	}

	drop(evt) {
		evt.stopPropagation();
		evt.preventDefault();

		var files = evt.dataTransfer.files,
			binary = files[0],
			that = this;

		if (files.length < 0) { return ; }

		this.body.figure.innerHTML = binary.name + " inserted";

		var reader = new FileReader();
		reader.onload = function(e) {
			that.system.insert_figure(e.target.results);
		}
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

		//this.body.port.innerHTML = portTemplate(port);

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
		var that = this;

		// Update basic views
		for (const [register, elem] of Object.entries(this.body.registers)){
			elem.innerHTML = toHex(2, that.system[register]);
		}

		for (const [flag, elem] of Object.entries(this.body.flags)) {
			elem.classList.toggle("active", Boolean(that.system[flag]));
		}

		for (const [i, m] of Object.entries(this.body.memory)) {
			m.innerHTML = toHex(2, that.system._wram[i]);
		}

		for (const [i, m] of Object.entries(this.body.control)) {
			var acc = that.system._cpuacc[i+0x3000];
			that.system._cpuacc[i+0x3000] = 0;
			m.classList.toggle('read', acc & ACCESS_READ);
			m.classList.toggle('write', acc & ACCESS_WRITE);
			m.innerHTML = toHex(2, that.system._cpureg[i]);
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
			var row = that.body.instructions[i];

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

		for (var i = disasm.length; i < config.instructionCount; i++) {
			var row = that.body.instructions[i];

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
		var data = Object.create(config),
			that = this;

		data.toHex = toHex;
		data.ramBytes = this.system._wram.length;
		data.registerBytes = this.system._cpureg.length;

		data.debug = Boolean(element.attributes.debugger);

		var column = document.createElement("div");

		var display = document.createElement("display");
		display.appendChild(document.createElement("figure"));

		var topIcons = document.createElement("div");
		for (var icon of ["icon-dashboard", "icon-food", "icon-trash", "icon-globe", "icon-user"]) {
			var i = document.createElement("i");
			i.classList.add("icon");
			i.classList.add(icon);
			i.classList.add("glyph");
			topIcons.appendChild(i);
		}
		display.appendChild(topIcons);

		var canvas = document.createElement("canvas");
		canvas.width = 48;
		canvas.height = 31;
		display.appendChild(canvas);

		var bottomIcons = document.createElement("div");
		for (var icon of ["icon-comments", "icon-medkit", "icon-heart", "icon-book", "icon-bell"]) {
			var i = document.createElement("i");
			i.classList.add("icon");
			i.classList.add(icon);
			i.classList.add("glyph");
			bottomIcons.appendChild(i);
		}
		display.appendChild(bottomIcons);
		column.appendChild(display);

		if (data.debug) {
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

			var control = document.createElement("control");
			for (var i = 0; i < data.registerBytes; i += data.registerBytesPerLine ) {
				var row = document.createElement("row");
				var address = document.createElement("address");
				address.innerText = toHex(4, i+0x3000);
				for (var b = 0; b < data.registerBytesPerLine; b ++ ) {
					var byte = document.createElement("byte");
					byte.setAttribute("data-address", i+b+0x3000);
					address.appendChild(byte);
				}
				row.appendChild(address);
				control.appendChild(row);
			}

			column.appendChild(control);
		}

		element.appendChild(column);
		if (data.debug) {
			column = document.createElement("div");
			var disassembly = document.createElement("disassembly");
			for (var i = 0; i < data.instructionCount; i++ ) {
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
			var memory = document.createElement("memory");
			for (var i = 0; i < data.ramBytes; i += data.memoryBytesPerLine ) {
				var row = document.createElement("row");
				var address = document.createElement("address");
				address.innerText = toHex(4, i);
				for (var b = 0; b < data.memoryBytesPerLine; b ++ ) {
					var byte = document.createElement("byte");
					byte.setAttribute("data-address", i+b);
					address.appendChild(byte);
				}
				row.appendChild(address);
				memory.appendChild(row);
			}
			column.appendChild(memory);
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
		if (data.debug) {
			for (var el of document.querySelectorAll("input[type=button]")) {
				el.addEventListener("click", that[el.attributes.action.value].bind(that))
			}

			this.body = {
				glyphs: element.querySelectorAll("i.glyph"),
				port: element.querySelector("port"),
				selects: [].reduce.call(element.querySelectorAll("select"), function (acc, f) {
					acc[f.attributes.action.value.toLowerCase()] = f;
					return acc;
				}, {}),
				flags: [].reduce.call(element.querySelectorAll("flag"), function (acc, f) {
					acc[f.attributes.name.value.toLowerCase()] = f;
					return acc;
				}, {}),
				registers: [].reduce.call(element.querySelectorAll("register"), function (acc, r) {
					acc[r.attributes.name.value.toLowerCase()] = r;
					return acc;
				}, {}),
				instructions: [].map.call(element.querySelectorAll("instruction"), function (i) {
					return {
						instruction: i,
						location: i.querySelector("location"),
						opcode: i.querySelector("opcode"),
						data: i.querySelector("data"),
						addressing: i.querySelector("addressing"),
					};
				}),
				control: [].map.call(element.querySelectorAll("control byte"), function (b) {
					b.addEventListener("click", that.update_control.bind(that));
					return b;
				}),
				memory: [...element.querySelectorAll("memory byte")],
				display: element.querySelector("display canvas").getContext("2d"),
				figure: element.querySelector("display figure")
			};

			document.querySelector("select[action=figure]").addEventListener("change", function(e) {
				that.system.inserted_figure = Number(e.target.value);
			});

			this._debug_port = 0x3000;
			this.update_control();

			this.refresh = this.refresh_debugger;
		} else {
			this.body = {
				glyphs: element.querySelectorAll("i.glyph"),
				display: element.querySelector("display canvas").getContext("2d"),
				figure: element.querySelector("display figure")
			};

			this.refresh = this.refresh_simple;
			// Start running soon
			setTimeout(function() { that.run(); }, 10);
		}
	};
}

getBinary("files/tamago.bin", function (bios) {
	// Start the application when BIOS is done
	for (var elem of document.querySelectorAll("tamago")) {
		new Tamago(elem, bios);
	}
});
