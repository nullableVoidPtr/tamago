import paddedEncode from "./encode.js";
import disassemble from "./cpu/disassembler.js";

window.customElements.define('disassembly-listing', class extends HTMLElement {
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
		this.offset = 0;
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

	update(system) {
		var disasm = disassemble(this.instructionCount, this.offset, system),
			bias = Math.floor(this.instructionCount / 2),
			current = disasm.findIndex((i) => i.active);

		// PC isn't were it should be
		if (current == -1) {
			this.offset = system.pc;
			disasm = disassemble(this.instructionCount, this.offset, system);
		} else if (current >= bias && disasm.length == this.instructionCount) {
			this.offset = disasm[current-bias].location;
			disasm = disassemble(this.instructionCount, this.offset, system);
		}

		for (const [i, g] of Object.entries(disasm)) {
			var instruction = this.instructions[i];
			instruction.address.innerHTML = paddedEncode(g.location, 4)
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
