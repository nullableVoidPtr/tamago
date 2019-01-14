import paddedEncode from "./encode.js";
import ports from "./data/ports.js";

window.customElements.define('port-info', class extends HTMLElement {
	static get observedAttributes() {
		return ['address'];
	}

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

	connectedCallback() {
		this.header = document.createElement("h1");
		this.header.classList.add("header");
		this.shadowRoot.appendChild(this.header);
		this.fieldList = document.createElement("div");
		this.shadowRoot.appendChild(this.fieldList);
		if (!this.hasAttribute('address'))
			this.setAttribute('address', 0x3000);
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
		p.address = paddedEncode(this.address, 2);
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

		for (var f of this.fieldList.children) {
			var l = Number(f.dataset.length),
				s = Number(f.dataset.start),
				m = (d >> s) & ((1 << l) - 1);

			f.binary.innerHTML = paddedEncode(m, l, 2);
			f.hexadecimal.innerHTML = paddedEncode(m.toString(16), Math.ceil(l / 4));
		}
	}

	set address(value) {
		this.setAttribute('address', value);
    }

	get address() {
		return Number(this.getAttribute('address')) || 0;
    }
});
