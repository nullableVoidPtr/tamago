export default function (n, width, radix = 16) {
	n = n.toString(radix).toUpperCase();
	return "0".repeat(width).substr(n.length) + n;
}
