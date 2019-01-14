window.customElements.define('tamago-display', class extends HTMLElement {
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
