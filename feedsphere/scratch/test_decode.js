
const corrupted = "\u000417\u00164\u000117 \u0005f4\u0005f2\u0005f1\u0005f0\u0005f5\u0005f0\u0005f1\u0005f0\u0005f2";

function tryDecode(str) {
  // Try to combine \u0005 and the following hex chars into a single char
  let result = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\u0005' && i + 2 < str.length) {
      const hex = str.substring(i + 1, i + 3);
      const code = parseInt("05" + hex, 16);
      result += String.fromCharCode(code);
      i += 2;
    } else if (str[i] === '\u0004' && i + 2 < str.length) {
      const hex = str.substring(i + 1, i + 3);
      const code = parseInt("04" + hex, 16);
      result += String.fromCharCode(code);
      i += 2;
    } else {
      result += str[i];
    }
  }
  return result;
}

console.log("Original:", corrupted);
console.log("Decoded:", tryDecode(corrupted));
