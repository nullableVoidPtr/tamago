import Tamagotchi from "./cpu/tamagotchi.js";
import paddedEncode from "./encode.js"

import "./display.js";
import "./hexdump.js";
import "./disassembly.js";
import "./cpuinfo.js";
import "./portinfo.js";

window.customElements.define('tamago-main', class extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this.mapping = { 65: 1, 83: 2, 68: 4, 82: 8 };

		document.addEventListener("keydown", e => this.system.keys &= ~this.mapping[e.keyCode] || 0xFF);
		document.addEventListener("keyup", e => this.system.keys |= this.mapping[e.keyCode] || 0);
		var style = document.createElement("style");
		style.textContent = `
			:host {
				display: flex;
				justify-content: space-evenly;
				position: relative;
				color: black;
			}

			.buttons {
				display: flex;
				justify-content: space-evenly;
			}

			tamago-display {
				padding: 10px;
			}
			
			port-info {
				height: 13em;
			}

			hex-dump {
				display: block;
				overflow-y: scroll;
			}

			.memory {
				height: 42em;
			}

			.control {
				height: 24em;
			}
		`;
		this.shadowRoot.appendChild(style);
	}
	
	connectedCallback() {
		fetch(this.getAttribute("bios")).then(
			response => response.arrayBuffer()
		).then(
			bios => this.init(bios)
		).catch(
			err => console.error(err.message, err)
		)
	}
	
	init(bios) {
		this.system = new Tamagotchi(bios);

		this.configure();

		this.refresh();
	}

	step(e) {
		this.system.step();
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

		this.shadowRoot.querySelector("input[type=button][value=step]").disabled = this.running = !this.running;
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

	configure() {
		var column = document.createElement("div");
		this.display = document.createElement("tamago-display");

		column.appendChild(this.display);
		if (this.debug) {
			var debuggerButtons = document.createElement("div");
			debuggerButtons.classList.add("buttons");
			for (var action of [
				this.step,
				this.run,
				this.reset,
				this.nmi,
			]) {
				var button = document.createElement("input");
				button.type = "button";
				button.value = action.name;
				button.addEventListener("click", action.bind(this))
				debuggerButtons.appendChild(button);
			}

			column.appendChild(debuggerButtons);

			var irqForm = document.createElement("buttons");
			irqForm.classList.add("buttons");
			var figureSelect = document.createElement("select");
			for (const [value, text] of Object.entries(["No Figure", "Fig1", "Fig2", "Fig3"])) {
				var option = document.createElement("option");
				option.value = value;
				option.innerText = text;
				figureSelect.appendChild(option);
			}
			figureSelect.addEventListener("change", e => this.system.inserted_figure = Number(e.target.value));
			irqForm.appendChild(figureSelect)

			this.selectedIrq = document.createElement("select");
			for (const [value, text] of Object.entries(["TIM0",,, "2048", "8192", "SPU", "FPI", "FP",,, "TIM1", "TBH", "TBL"])) {
				var option = document.createElement("option");
				option.value = value;
				option.innerText = `${value}: ${text}`;
				this.selectedIrq.appendChild(option);
			}
			irqForm.appendChild(this.selectedIrq);

			var irqButton = document.createElement("input");
			irqButton.type = "button";
			irqButton.value = "irq";
			irqButton.addEventListener("click", e => {
				this.system.fire_irq(parseInt(this.selectedIrq.value,10));
				this.refresh();
			});
			irqForm.appendChild(irqButton);

			column.appendChild(irqForm);

			this.CPUInfo = document.createElement("cpu-info");
			column.appendChild(this.CPUInfo);

			this.control = document.createElement("hex-dump");
			this.control.virtualOffset = 0x3000;
			this.control.byteLength = this.system._cpureg.length;
			this.control.rowLength = 8;
			this.control.byteCallback = e => this.portInfo.address = parseInt(e.target.dataset.address);
			this.control.classList.add("control");
			column.appendChild(this.control);
		}
		
		this.shadowRoot.appendChild(column);
		if (this.debug) {
			column = document.createElement("div");
			this.disassembly = document.createElement("disassembly-listing");
			column.appendChild(this.disassembly);
			this.shadowRoot.appendChild(column);

			column = document.createElement("div");
			this.portInfo = document.createElement("port-info");
			this.portInfo.system = this.system;
			column.appendChild(this.portInfo);

			this.memory = document.createElement("hex-dump");
			this.memory.byteLength = this.system._wram.length;
			this.memory.classList.add("memory");
			column.appendChild(this.memory);
			this.shadowRoot.appendChild(column);
		}

		function noopHandler(evt) {
			evt.stopPropagation();
			evt.preventDefault();
		}

		this.shadowRoot.addEventListener("dragenter", noopHandler, false);
		this.shadowRoot.addEventListener("dragexit", noopHandler, false);
		this.shadowRoot.addEventListener("dragover", noopHandler, false);
		this.shadowRoot.addEventListener("drop", this.drop.bind(this), false);

		if (this.debug) {
			this.refresh = this.refresh_debugger;
		} else {
			this.refresh = this.refresh_simple;
			// Start running soon
			setTimeout(function() { this.run(); }, 10);
		}
	}
	
	set debug(value) {
		if (Boolean(value))
			this.setAttribute('debug', '');
		else
			this.removeAttribute('debug');
	}

    get debug() {
      return this.hasAttribute('debug');
    }
});
