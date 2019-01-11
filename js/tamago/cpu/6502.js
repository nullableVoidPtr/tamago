import addressing from "./address.js";
import operations from "./operations.js";
import instructions from "../data/instructions.js";

export default class r6502 {
	constructor() {
		this.ops = {};
	}

	init() {
		this.a = 0;
		this.x = 0;
		this.y = 0;
		this.s = 0;
		this.p = 0;
		this.cycles = 0;
		this.pc = 0;

		for (const [code, op] of Object.entries(instructions)) {
			this.ops[code] = {
				operation: operations[op.instruction],
				address: addressing[op.addressing],
				cycles: op.cycles
			};
		}
	}

	reset() {
		this.pc = this.read_16(0xFFFC);
	}

	nmi() {
		this.push(this.pc >> 8);
		this.push(this.pc & 0xFF);
		this.push(this.p);

		this.pc = this.read_16(0xFFFA);
	}

	irq(brk) {
		this.push(this.pc >> 8);
		this.push(this.pc & 0xFF);
		this.push(this.p | (brk ? 0x10 : 0));

		this.pc = this.read_16(0xFFFE);

		this.i = 1;
	}

	step() {
		// Fire pending IRQs
		if (!this.i && this.pending_irq) { this.irq(); }

		var next = this.ops[this.next()];
		if (next === undefined) { throw new Error("System has crashed (invalid operation)"); }
		next.operation(this, next.address(this));
		this.cycles -= next.cycles;
	}

	next() {
		var d = this.read(this.pc++);
		this.pc &= 0xFFFF;
		return d;
	}

	next_16() {
		var l = this.next(),
			h = this.next();

		return l | (h << 8);
	}

	read_16(addr) {
		var l = this.read(addr),
			h = this.read((addr+1) & 0xFFFF);

		return l | (h << 8);
	}

	pull() {
		this.s = (this.s + 1) & 0xFF;
		return this.read(this.s | 0x100);
	}

	push(data) {
		this.write(this.s | 0x100, data);
		this.s = (this.s - 1) & 0xFF;
	}

	get p() {
		return ((this.c) ? 0x01: 0) |
			((this.z) ? 0x02: 0) |
			((this.i) ? 0x04: 0) |
			((this.d) ? 0x08: 0) |
			0x20 | // Always set
			((this.v) ? 0x40: 0) |
			((this.n) ? 0x80: 0);
	}

	set p(v) {
		this.c = v & 0x01;
		this.z = v & 0x02;
		this.i = v & 0x04;
		this.d = v & 0x08;
		this.v = v & 0x40;
		this.n = v & 0x80;
	}
}
