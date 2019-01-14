import {ACCESS_READ, ACCESS_WRITE} from "./cpu/tamagotchi.js";
import paddedEncode from "./encode.js"

window.customElements.define('hex-dump', class extends HTMLElement {
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
				offset.innerText = paddedEncode(this.virtualOffset + i, 4);
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
			cell.innerHTML = paddedEncode(memory[i], 2);
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
