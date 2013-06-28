module.exports = (function(){
	var r6502 = {};

	r6502.reset = function () {
		this.a = 0;
		this.x = 0;
		this.y = 0;
		this.pc = this.read_16(0xFFFC);
		this.s = 0;
		this.p = 0;
		this.cycles = 0;
	}

	r6502.step = function () {
		// TODO!
		this.cycles--;
	}

	r6502.read_16 = function (addr) {
		var l = this.read(addr),
			h = this.read((addr+1) & 0xFFFF);

		return l | (h << 8);
	}

	r6502.pull = function () {
		this.s = (this.s + 1) & 0xFF;
		return this.read(this.s | 0x100);
	}

	r6502.push = function (data) {
		this.write(this.s | 0x100, data);
		this.s = (this.s - 1) & 0xFF;
	}

	Object.defineProperty(r6502, "p", {
		get: function () {
			return 
				((this.c) ? 0x01: 0) |
				((this.z) ? 0x02: 0) |
				((this.i) ? 0x04: 0) |
				((this.d) ? 0x08: 0) |
				((this.b) ? 0x10: 0) |
				((this.v) ? 0x40: 0) |
				((this.n) ? 0x80: 0);
		},
		set: function (v) {
			this.c = v & 0x01;
			this.z = v & 0x02;
			this.i = v & 0x04;
			this.d = v & 0x08;
			this.b = v & 0x10;
			this.v = v & 0x40;
			this.n = v & 0x80;
		}
	})

	return r6502;
})();
