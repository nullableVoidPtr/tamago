import paddedEncode from "./encode.js";

window.customElements.define('cpu-info', class extends HTMLElement {
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
			elem.innerHTML = paddedEncode(system[register], 2);
		}

		for (const [flag, elem] of Object.entries(this.flags)) {
			elem.checked = Boolean(system[flag]);
		}
	}
});
