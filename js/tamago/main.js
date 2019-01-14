import Tamagotchi from "./cpu/tamagotchi.js";
import paddedEncode from "./encode.js"

import "./display.js";
import "./hexdump.js";
import "./disassembly.js";
import "./cpuinfo.js";
import "./portinfo.js";

class Tamago {
	constructor(element, bios) {
		var that = this;

		this.system = new Tamagotchi(bios);

		this.configure(element);

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

		this.CPUInfo.update(this.system);

		this.memory.update(this.system._wram);

		this.control.update(this.system._cpureg, this.system._cpuacc);

		this.disassembly.update(this.system);

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
			this.control.rowLength = 8;
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
	for (var elem of document.querySelectorAll("tamago")) {
		new Tamago(elem, bios);
	}
});
