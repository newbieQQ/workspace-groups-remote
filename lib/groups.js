import { lstat, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
	if (hasRequiredCommon) return common;
	hasRequiredCommon = 1;
	function isNothing(subject) {
		return typeof subject === "undefined" || subject === null;
	}
	function isObject(subject) {
		return typeof subject === "object" && subject !== null;
	}
	function toArray(sequence) {
		if (Array.isArray(sequence)) return sequence;
		else if (isNothing(sequence)) return [];
		return [sequence];
	}
	function extend(target, source) {
		if (source) {
			const sourceKeys = Object.keys(source);
			for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
				const key = sourceKeys[index];
				target[key] = source[key];
			}
		}
		return target;
	}
	function repeat(string, count) {
		let result = "";
		for (let cycle = 0; cycle < count; cycle += 1) result += string;
		return result;
	}
	function isNegativeZero(number) {
		return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
	}
	common.isNothing = isNothing;
	common.isObject = isObject;
	common.toArray = toArray;
	common.repeat = repeat;
	common.isNegativeZero = isNegativeZero;
	common.extend = extend;
	return common;
}
var exception;
var hasRequiredException;
function requireException() {
	if (hasRequiredException) return exception;
	hasRequiredException = 1;
	function formatError(exception2, compact) {
		let where = "";
		const message = exception2.reason || "(unknown reason)";
		if (!exception2.mark) return message;
		if (exception2.mark.name) where += "in \"" + exception2.mark.name + "\" ";
		where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
		if (!compact && exception2.mark.snippet) where += "\n\n" + exception2.mark.snippet;
		return message + " " + where;
	}
	function YAMLException2(reason, mark) {
		Error.call(this);
		this.name = "YAMLException";
		this.reason = reason;
		this.mark = mark;
		this.message = formatError(this, false);
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		else this.stack = (/* @__PURE__ */ new Error()).stack || "";
	}
	YAMLException2.prototype = Object.create(Error.prototype);
	YAMLException2.prototype.constructor = YAMLException2;
	YAMLException2.prototype.toString = function toString(compact) {
		return this.name + ": " + formatError(this, compact);
	};
	exception = YAMLException2;
	return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
	if (hasRequiredSnippet) return snippet;
	hasRequiredSnippet = 1;
	const common2 = requireCommon();
	function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
		let head = "";
		let tail = "";
		const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
		if (position - lineStart > maxHalfLength) {
			head = " ... ";
			lineStart = position - maxHalfLength + head.length;
		}
		if (lineEnd - position > maxHalfLength) {
			tail = " ...";
			lineEnd = position + maxHalfLength - tail.length;
		}
		return {
			str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
			pos: position - lineStart + head.length
		};
	}
	function padStart(string, max) {
		return common2.repeat(" ", max - string.length) + string;
	}
	function makeSnippet(mark, options) {
		options = Object.create(options || null);
		if (!mark.buffer) return null;
		if (!options.maxLength) options.maxLength = 79;
		if (typeof options.indent !== "number") options.indent = 1;
		if (typeof options.linesBefore !== "number") options.linesBefore = 3;
		if (typeof options.linesAfter !== "number") options.linesAfter = 2;
		const re = /\r?\n|\r|\0/g;
		const lineStarts = [0];
		const lineEnds = [];
		let match;
		let foundLineNo = -1;
		while (match = re.exec(mark.buffer)) {
			lineEnds.push(match.index);
			lineStarts.push(match.index + match[0].length);
			if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
		}
		if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
		let result = "";
		const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
		const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
		for (let i = 1; i <= options.linesBefore; i++) {
			if (foundLineNo - i < 0) break;
			const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
			result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
		}
		const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
		result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
		for (let i = 1; i <= options.linesAfter; i++) {
			if (foundLineNo + i >= lineEnds.length) break;
			const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
			result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
		}
		return result.replace(/\n$/, "");
	}
	snippet = makeSnippet;
	return snippet;
}
var type;
var hasRequiredType;
function requireType() {
	if (hasRequiredType) return type;
	hasRequiredType = 1;
	const YAMLException2 = requireException();
	const TYPE_CONSTRUCTOR_OPTIONS = [
		"kind",
		"multi",
		"resolve",
		"construct",
		"instanceOf",
		"predicate",
		"represent",
		"representName",
		"defaultStyle",
		"styleAliases"
	];
	const YAML_NODE_KINDS = [
		"scalar",
		"sequence",
		"mapping"
	];
	function compileStyleAliases(map2) {
		const result = {};
		if (map2 !== null) Object.keys(map2).forEach(function(style) {
			map2[style].forEach(function(alias) {
				result[String(alias)] = style;
			});
		});
		return result;
	}
	function Type2(tag, options) {
		options = options || {};
		Object.keys(options).forEach(function(name) {
			if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException2("Unknown option \"" + name + "\" is met in definition of \"" + tag + "\" YAML type.");
		});
		this.options = options;
		this.tag = tag;
		this.kind = options["kind"] || null;
		this.resolve = options["resolve"] || function() {
			return true;
		};
		this.construct = options["construct"] || function(data) {
			return data;
		};
		this.instanceOf = options["instanceOf"] || null;
		this.predicate = options["predicate"] || null;
		this.represent = options["represent"] || null;
		this.representName = options["representName"] || null;
		this.defaultStyle = options["defaultStyle"] || null;
		this.multi = options["multi"] || false;
		this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
		if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException2("Unknown kind \"" + this.kind + "\" is specified for \"" + tag + "\" YAML type.");
	}
	type = Type2;
	return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
	if (hasRequiredSchema) return schema;
	hasRequiredSchema = 1;
	const YAMLException2 = requireException();
	const Type2 = requireType();
	function compileList(schema2, name) {
		const result = [];
		schema2[name].forEach(function(currentType) {
			let newIndex = result.length;
			result.forEach(function(previousType, previousIndex) {
				if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
			});
			result[newIndex] = currentType;
		});
		return result;
	}
	function compileMap() {
		const result = {
			scalar: {},
			sequence: {},
			mapping: {},
			fallback: {},
			multi: {
				scalar: [],
				sequence: [],
				mapping: [],
				fallback: []
			}
		};
		function collectType(type2) {
			if (type2.multi) {
				result.multi[type2.kind].push(type2);
				result.multi["fallback"].push(type2);
			} else result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
		}
		for (let index = 0, length = arguments.length; index < length; index += 1) arguments[index].forEach(collectType);
		return result;
	}
	function Schema2(definition) {
		return this.extend(definition);
	}
	Schema2.prototype.extend = function extend(definition) {
		let implicit = [];
		let explicit = [];
		if (definition instanceof Type2) explicit.push(definition);
		else if (Array.isArray(definition)) explicit = explicit.concat(definition);
		else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
			if (definition.implicit) implicit = implicit.concat(definition.implicit);
			if (definition.explicit) explicit = explicit.concat(definition.explicit);
		} else throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
		implicit.forEach(function(type2) {
			if (!(type2 instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
			if (type2.loadKind && type2.loadKind !== "scalar") throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
			if (type2.multi) throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
		});
		explicit.forEach(function(type2) {
			if (!(type2 instanceof Type2)) throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
		});
		const result = Object.create(Schema2.prototype);
		result.implicit = (this.implicit || []).concat(implicit);
		result.explicit = (this.explicit || []).concat(explicit);
		result.compiledImplicit = compileList(result, "implicit");
		result.compiledExplicit = compileList(result, "explicit");
		result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
		return result;
	};
	schema = Schema2;
	return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
	if (hasRequiredStr) return str;
	hasRequiredStr = 1;
	str = new (requireType())("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: function(data) {
			return data !== null ? data : "";
		}
	});
	return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
	if (hasRequiredSeq) return seq;
	hasRequiredSeq = 1;
	seq = new (requireType())("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: function(data) {
			return data !== null ? data : [];
		}
	});
	return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
	if (hasRequiredMap) return map;
	hasRequiredMap = 1;
	map = new (requireType())("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: function(data) {
			return data !== null ? data : {};
		}
	});
	return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
	if (hasRequiredFailsafe) return failsafe;
	hasRequiredFailsafe = 1;
	failsafe = new (requireSchema())({ explicit: [
		requireStr(),
		requireSeq(),
		requireMap()
	] });
	return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
	if (hasRequired_null) return _null;
	hasRequired_null = 1;
	const Type2 = requireType();
	function resolveYamlNull(data) {
		if (data === null) return true;
		const max = data.length;
		return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
	}
	function constructYamlNull() {
		return null;
	}
	function isNull(object) {
		return object === null;
	}
	_null = new Type2("tag:yaml.org,2002:null", {
		kind: "scalar",
		resolve: resolveYamlNull,
		construct: constructYamlNull,
		predicate: isNull,
		represent: {
			canonical: function() {
				return "~";
			},
			lowercase: function() {
				return "null";
			},
			uppercase: function() {
				return "NULL";
			},
			camelcase: function() {
				return "Null";
			},
			empty: function() {
				return "";
			}
		},
		defaultStyle: "lowercase"
	});
	return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
	if (hasRequiredBool) return bool;
	hasRequiredBool = 1;
	const Type2 = requireType();
	function resolveYamlBoolean(data) {
		if (data === null) return false;
		const max = data.length;
		return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
	}
	function constructYamlBoolean(data) {
		return data === "true" || data === "True" || data === "TRUE";
	}
	function isBoolean(object) {
		return Object.prototype.toString.call(object) === "[object Boolean]";
	}
	bool = new Type2("tag:yaml.org,2002:bool", {
		kind: "scalar",
		resolve: resolveYamlBoolean,
		construct: constructYamlBoolean,
		predicate: isBoolean,
		represent: {
			lowercase: function(object) {
				return object ? "true" : "false";
			},
			uppercase: function(object) {
				return object ? "TRUE" : "FALSE";
			},
			camelcase: function(object) {
				return object ? "True" : "False";
			}
		},
		defaultStyle: "lowercase"
	});
	return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
	if (hasRequiredInt) return int;
	hasRequiredInt = 1;
	const common2 = requireCommon();
	const Type2 = requireType();
	function isHexCode(c) {
		return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
	}
	function isOctCode(c) {
		return c >= 48 && c <= 55;
	}
	function isDecCode(c) {
		return c >= 48 && c <= 57;
	}
	function resolveYamlInteger(data) {
		if (data === null) return false;
		const max = data.length;
		let index = 0;
		let hasDigits = false;
		if (!max) return false;
		let ch = data[index];
		if (ch === "-" || ch === "+") ch = data[++index];
		if (ch === "0") {
			if (index + 1 === max) return true;
			ch = data[++index];
			if (ch === "b") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch !== "0" && ch !== "1") return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
			if (ch === "x") {
				index++;
				for (; index < max; index++) {
					if (!isHexCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
			if (ch === "o") {
				index++;
				for (; index < max; index++) {
					if (!isOctCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && isFinite(parseYamlInteger(data));
			}
		}
		for (; index < max; index++) {
			if (!isDecCode(data.charCodeAt(index))) return false;
			hasDigits = true;
		}
		if (!hasDigits) return false;
		return isFinite(parseYamlInteger(data));
	}
	function parseYamlInteger(data) {
		let value = data;
		let sign = 1;
		let ch = value[0];
		if (ch === "-" || ch === "+") {
			if (ch === "-") sign = -1;
			value = value.slice(1);
			ch = value[0];
		}
		if (value === "0") return 0;
		if (ch === "0") {
			if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
			if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
			if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
		}
		return sign * parseInt(value, 10);
	}
	function constructYamlInteger(data) {
		return parseYamlInteger(data);
	}
	function isInteger(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common2.isNegativeZero(object);
	}
	int = new Type2("tag:yaml.org,2002:int", {
		kind: "scalar",
		resolve: resolveYamlInteger,
		construct: constructYamlInteger,
		predicate: isInteger,
		represent: {
			binary: function(obj) {
				return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
			},
			octal: function(obj) {
				return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
			},
			decimal: function(obj) {
				return obj.toString(10);
			},
			hexadecimal: function(obj) {
				return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
			}
		},
		defaultStyle: "decimal",
		styleAliases: {
			binary: [2, "bin"],
			octal: [8, "oct"],
			decimal: [10, "dec"],
			hexadecimal: [16, "hex"]
		}
	});
	return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
	if (hasRequiredFloat) return float;
	hasRequiredFloat = 1;
	const common2 = requireCommon();
	const Type2 = requireType();
	const YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	const YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	function resolveYamlFloat(data) {
		if (data === null) return false;
		if (!YAML_FLOAT_PATTERN.test(data)) return false;
		if (isFinite(parseFloat(data, 10))) return true;
		return YAML_FLOAT_SPECIAL_PATTERN.test(data);
	}
	function constructYamlFloat(data) {
		let value = data.toLowerCase();
		const sign = value[0] === "-" ? -1 : 1;
		if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
		if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
		else if (value === ".nan") return NaN;
		return sign * parseFloat(value, 10);
	}
	const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
	function representYamlFloat(object, style) {
		if (isNaN(object)) switch (style) {
			case "lowercase": return ".nan";
			case "uppercase": return ".NAN";
			case "camelcase": return ".NaN";
		}
		else if (Number.POSITIVE_INFINITY === object) switch (style) {
			case "lowercase": return ".inf";
			case "uppercase": return ".INF";
			case "camelcase": return ".Inf";
		}
		else if (Number.NEGATIVE_INFINITY === object) switch (style) {
			case "lowercase": return "-.inf";
			case "uppercase": return "-.INF";
			case "camelcase": return "-.Inf";
		}
		else if (common2.isNegativeZero(object)) return "-0.0";
		const res = object.toString(10);
		return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
	}
	function isFloat(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
	}
	float = new Type2("tag:yaml.org,2002:float", {
		kind: "scalar",
		resolve: resolveYamlFloat,
		construct: constructYamlFloat,
		predicate: isFloat,
		represent: representYamlFloat,
		defaultStyle: "lowercase"
	});
	return float;
}
var json;
var hasRequiredJson;
function requireJson() {
	if (hasRequiredJson) return json;
	hasRequiredJson = 1;
	json = requireFailsafe().extend({ implicit: [
		require_null(),
		requireBool(),
		requireInt(),
		requireFloat()
	] });
	return json;
}
var core;
var hasRequiredCore;
function requireCore() {
	if (hasRequiredCore) return core;
	hasRequiredCore = 1;
	core = requireJson();
	return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
	if (hasRequiredTimestamp) return timestamp;
	hasRequiredTimestamp = 1;
	const Type2 = requireType();
	const YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
	const YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
	function resolveYamlTimestamp(data) {
		if (data === null) return false;
		if (YAML_DATE_REGEXP.exec(data) !== null) return true;
		if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
		return false;
	}
	function constructYamlTimestamp(data) {
		let fraction = 0;
		let delta = null;
		let match = YAML_DATE_REGEXP.exec(data);
		if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
		if (match === null) throw new Error("Date resolve error");
		const year = +match[1];
		const month = +match[2] - 1;
		const day = +match[3];
		if (!match[4]) return new Date(Date.UTC(year, month, day));
		const hour = +match[4];
		const minute = +match[5];
		const second = +match[6];
		if (match[7]) {
			fraction = match[7].slice(0, 3);
			while (fraction.length < 3) fraction += "0";
			fraction = +fraction;
		}
		if (match[9]) {
			const tzHour = +match[10];
			const tzMinute = +(match[11] || 0);
			delta = (tzHour * 60 + tzMinute) * 6e4;
			if (match[9] === "-") delta = -delta;
		}
		const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
		if (delta) date.setTime(date.getTime() - delta);
		return date;
	}
	function representYamlTimestamp(object) {
		return object.toISOString();
	}
	timestamp = new Type2("tag:yaml.org,2002:timestamp", {
		kind: "scalar",
		resolve: resolveYamlTimestamp,
		construct: constructYamlTimestamp,
		instanceOf: Date,
		represent: representYamlTimestamp
	});
	return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
	if (hasRequiredMerge) return merge;
	hasRequiredMerge = 1;
	const Type2 = requireType();
	function resolveYamlMerge(data) {
		return data === "<<" || data === null;
	}
	merge = new Type2("tag:yaml.org,2002:merge", {
		kind: "scalar",
		resolve: resolveYamlMerge
	});
	return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
	if (hasRequiredBinary) return binary;
	hasRequiredBinary = 1;
	const Type2 = requireType();
	const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
	function resolveYamlBinary(data) {
		if (data === null) return false;
		let bitlen = 0;
		const max = data.length;
		const map2 = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			const code = map2.indexOf(data.charAt(idx));
			if (code > 64) continue;
			if (code < 0) return false;
			bitlen += 6;
		}
		return bitlen % 8 === 0;
	}
	function constructYamlBinary(data) {
		const input = data.replace(/[\r\n=]/g, "");
		const max = input.length;
		const map2 = BASE64_MAP;
		let bits = 0;
		const result = [];
		for (let idx = 0; idx < max; idx++) {
			if (idx % 4 === 0 && idx) {
				result.push(bits >> 16 & 255);
				result.push(bits >> 8 & 255);
				result.push(bits & 255);
			}
			bits = bits << 6 | map2.indexOf(input.charAt(idx));
		}
		const tailbits = max % 4 * 6;
		if (tailbits === 0) {
			result.push(bits >> 16 & 255);
			result.push(bits >> 8 & 255);
			result.push(bits & 255);
		} else if (tailbits === 18) {
			result.push(bits >> 10 & 255);
			result.push(bits >> 2 & 255);
		} else if (tailbits === 12) result.push(bits >> 4 & 255);
		return new Uint8Array(result);
	}
	function representYamlBinary(object) {
		let result = "";
		let bits = 0;
		const max = object.length;
		const map2 = BASE64_MAP;
		for (let idx = 0; idx < max; idx++) {
			if (idx % 3 === 0 && idx) {
				result += map2[bits >> 18 & 63];
				result += map2[bits >> 12 & 63];
				result += map2[bits >> 6 & 63];
				result += map2[bits & 63];
			}
			bits = (bits << 8) + object[idx];
		}
		const tail = max % 3;
		if (tail === 0) {
			result += map2[bits >> 18 & 63];
			result += map2[bits >> 12 & 63];
			result += map2[bits >> 6 & 63];
			result += map2[bits & 63];
		} else if (tail === 2) {
			result += map2[bits >> 10 & 63];
			result += map2[bits >> 4 & 63];
			result += map2[bits << 2 & 63];
			result += map2[64];
		} else if (tail === 1) {
			result += map2[bits >> 2 & 63];
			result += map2[bits << 4 & 63];
			result += map2[64];
			result += map2[64];
		}
		return result;
	}
	function isBinary(obj) {
		return Object.prototype.toString.call(obj) === "[object Uint8Array]";
	}
	binary = new Type2("tag:yaml.org,2002:binary", {
		kind: "scalar",
		resolve: resolveYamlBinary,
		construct: constructYamlBinary,
		predicate: isBinary,
		represent: representYamlBinary
	});
	return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
	if (hasRequiredOmap) return omap;
	hasRequiredOmap = 1;
	const Type2 = requireType();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const _toString = Object.prototype.toString;
	function resolveYamlOmap(data) {
		if (data === null) return true;
		const objectKeys = {};
		const object = data;
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			let pairHasKey = false;
			if (_toString.call(pair) !== "[object Object]") return false;
			let pairKey;
			for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) {
				if (!pairHasKey) pairHasKey = true;
				else return false;
			}
			if (!pairHasKey) return false;
			if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
			Object.defineProperty(objectKeys, pairKey, { value: true });
		}
		return true;
	}
	function constructYamlOmap(data) {
		return data !== null ? data : [];
	}
	omap = new Type2("tag:yaml.org,2002:omap", {
		kind: "sequence",
		resolve: resolveYamlOmap,
		construct: constructYamlOmap
	});
	return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
	if (hasRequiredPairs) return pairs;
	hasRequiredPairs = 1;
	const Type2 = requireType();
	const _toString = Object.prototype.toString;
	function resolveYamlPairs(data) {
		if (data === null) return true;
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			if (_toString.call(pair) !== "[object Object]") return false;
			const keys = Object.keys(pair);
			if (keys.length !== 1) return false;
			result[index] = [keys[0], pair[keys[0]]];
		}
		return true;
	}
	function constructYamlPairs(data) {
		if (data === null) return [];
		const object = data;
		const result = new Array(object.length);
		for (let index = 0, length = object.length; index < length; index += 1) {
			const pair = object[index];
			const keys = Object.keys(pair);
			result[index] = [keys[0], pair[keys[0]]];
		}
		return result;
	}
	pairs = new Type2("tag:yaml.org,2002:pairs", {
		kind: "sequence",
		resolve: resolveYamlPairs,
		construct: constructYamlPairs
	});
	return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
	if (hasRequiredSet) return set;
	hasRequiredSet = 1;
	const Type2 = requireType();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	function resolveYamlSet(data) {
		if (data === null) return true;
		const object = data;
		for (const key in object) if (_hasOwnProperty.call(object, key)) {
			if (object[key] !== null) return false;
		}
		return true;
	}
	function constructYamlSet(data) {
		return data !== null ? data : {};
	}
	set = new Type2("tag:yaml.org,2002:set", {
		kind: "mapping",
		resolve: resolveYamlSet,
		construct: constructYamlSet
	});
	return set;
}
var _default;
var hasRequired_default;
function require_default() {
	if (hasRequired_default) return _default;
	hasRequired_default = 1;
	_default = requireCore().extend({
		implicit: [requireTimestamp(), requireMerge()],
		explicit: [
			requireBinary(),
			requireOmap(),
			requirePairs(),
			requireSet()
		]
	});
	return _default;
}
var hasRequiredLoader;
function requireLoader() {
	if (hasRequiredLoader) return loader;
	hasRequiredLoader = 1;
	const common2 = requireCommon();
	const YAMLException2 = requireException();
	const makeSnippet = requireSnippet();
	const DEFAULT_SCHEMA2 = require_default();
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const CONTEXT_FLOW_IN = 1;
	const CONTEXT_FLOW_OUT = 2;
	const CONTEXT_BLOCK_IN = 3;
	const CONTEXT_BLOCK_OUT = 4;
	const CHOMPING_CLIP = 1;
	const CHOMPING_STRIP = 2;
	const CHOMPING_KEEP = 3;
	const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
	const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
	const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
	const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
	function _class(obj) {
		return Object.prototype.toString.call(obj);
	}
	function isEol(c) {
		return c === 10 || c === 13;
	}
	function isWhiteSpace(c) {
		return c === 9 || c === 32;
	}
	function isWsOrEol(c) {
		return c === 9 || c === 32 || c === 10 || c === 13;
	}
	function isFlowIndicator(c) {
		return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
	}
	function fromHexCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		const lc = c | 32;
		if (lc >= 97 && lc <= 102) return lc - 97 + 10;
		return -1;
	}
	function escapedHexLen(c) {
		if (c === 120) return 2;
		if (c === 117) return 4;
		if (c === 85) return 8;
		return 0;
	}
	function fromDecimalCode(c) {
		if (c >= 48 && c <= 57) return c - 48;
		return -1;
	}
	function simpleEscapeSequence(c) {
		switch (c) {
			case 48: return "\0";
			case 97: return "\x07";
			case 98: return "\b";
			case 116: return "	";
			case 9: return "	";
			case 110: return "\n";
			case 118: return "\v";
			case 102: return "\f";
			case 114: return "\r";
			case 101: return "\x1B";
			case 32: return " ";
			case 34: return "\"";
			case 47: return "/";
			case 92: return "\\";
			case 78: return "";
			case 95: return "\xA0";
			case 76: return "\u2028";
			case 80: return "\u2029";
			default: return "";
		}
	}
	function charFromCodepoint(c) {
		if (c <= 65535) return String.fromCharCode(c);
		return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
	}
	function setProperty(object, key, value) {
		if (key === "__proto__") Object.defineProperty(object, key, {
			configurable: true,
			enumerable: true,
			writable: true,
			value
		});
		else object[key] = value;
	}
	const simpleEscapeCheck = new Array(256);
	const simpleEscapeMap = new Array(256);
	for (let i = 0; i < 256; i++) {
		simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
		simpleEscapeMap[i] = simpleEscapeSequence(i);
	}
	function State(input, options) {
		this.input = input;
		this.filename = options["filename"] || null;
		this.schema = options["schema"] || DEFAULT_SCHEMA2;
		this.onWarning = options["onWarning"] || null;
		this.legacy = options["legacy"] || false;
		this.json = options["json"] || false;
		this.listener = options["listener"] || null;
		this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
		this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
		this.implicitTypes = this.schema.compiledImplicit;
		this.typeMap = this.schema.compiledTypeMap;
		this.length = input.length;
		this.position = 0;
		this.line = 0;
		this.lineStart = 0;
		this.lineIndent = 0;
		this.depth = 0;
		this.totalMergeKeys = 0;
		this.firstTabInLine = -1;
		this.documents = [];
		this.anchorMapTransactions = [];
	}
	function generateError(state, message) {
		const mark = {
			name: state.filename,
			buffer: state.input.slice(0, -1),
			position: state.position,
			line: state.line,
			column: state.position - state.lineStart
		};
		mark.snippet = makeSnippet(mark);
		return new YAMLException2(message, mark);
	}
	function throwError(state, message) {
		throw generateError(state, message);
	}
	function throwWarning(state, message) {
		if (state.onWarning) state.onWarning.call(null, generateError(state, message));
	}
	function storeAnchor(state, name, value) {
		const transactions = state.anchorMapTransactions;
		if (transactions.length !== 0) {
			const transaction = transactions[transactions.length - 1];
			if (!_hasOwnProperty.call(transaction, name)) transaction[name] = {
				existed: _hasOwnProperty.call(state.anchorMap, name),
				value: state.anchorMap[name]
			};
		}
		state.anchorMap[name] = value;
	}
	function beginAnchorTransaction(state) {
		state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
	}
	function commitAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const transactions = state.anchorMapTransactions;
		if (transactions.length === 0) return;
		const parent = transactions[transactions.length - 1];
		const names = Object.keys(transaction);
		for (let index = 0, length = names.length; index < length; index += 1) {
			const name = names[index];
			if (!_hasOwnProperty.call(parent, name)) parent[name] = transaction[name];
		}
	}
	function rollbackAnchorTransaction(state) {
		const transaction = state.anchorMapTransactions.pop();
		const names = Object.keys(transaction);
		for (let index = names.length - 1; index >= 0; index -= 1) {
			const entry = transaction[names[index]];
			if (entry.existed) state.anchorMap[names[index]] = entry.value;
			else delete state.anchorMap[names[index]];
		}
	}
	function snapshotState(state) {
		return {
			position: state.position,
			line: state.line,
			lineStart: state.lineStart,
			lineIndent: state.lineIndent,
			firstTabInLine: state.firstTabInLine,
			tag: state.tag,
			anchor: state.anchor,
			kind: state.kind,
			result: state.result
		};
	}
	function restoreState(state, snapshot) {
		state.position = snapshot.position;
		state.line = snapshot.line;
		state.lineStart = snapshot.lineStart;
		state.lineIndent = snapshot.lineIndent;
		state.firstTabInLine = snapshot.firstTabInLine;
		state.tag = snapshot.tag;
		state.anchor = snapshot.anchor;
		state.kind = snapshot.kind;
		state.result = snapshot.result;
	}
	const directiveHandlers = {
		YAML: function handleYamlDirective(state, name, args) {
			if (state.version !== null) throwError(state, "duplication of %YAML directive");
			if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
			const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
			if (match === null) throwError(state, "ill-formed argument of the YAML directive");
			const major = parseInt(match[1], 10);
			const minor = parseInt(match[2], 10);
			if (major !== 1) throwError(state, "unacceptable YAML version of the document");
			state.version = args[0];
			state.checkLineBreaks = minor < 2;
			if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
		},
		TAG: function handleTagDirective(state, name, args) {
			let prefix;
			if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
			const handle = args[0];
			prefix = args[1];
			if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
			if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, "there is a previously declared suffix for \"" + handle + "\" tag handle");
			if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
			try {
				prefix = decodeURIComponent(prefix);
			} catch (err) {
				throwError(state, "tag prefix is malformed: " + prefix);
			}
			state.tagMap[handle] = prefix;
		}
	};
	function captureSegment(state, start, end, checkJson) {
		if (start < end) {
			const _result = state.input.slice(start, end);
			if (checkJson) for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
				const _character = _result.charCodeAt(_position);
				if (!(_character === 9 || _character >= 32 && _character <= 1114111)) throwError(state, "expected valid JSON character");
			}
			else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
			state.result += _result;
		}
	}
	function chargeMergeWork(state) {
		state.totalMergeKeys++;
		if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
	}
	function mergeMappings(state, destination, source, overridableKeys) {
		if (!common2.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
		chargeMergeWork(state);
		const sourceKeys = Object.keys(source);
		for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
			const key = sourceKeys[index];
			chargeMergeWork(state);
			if (!_hasOwnProperty.call(destination, key)) {
				setProperty(destination, key, source[key]);
				overridableKeys[key] = true;
			}
		}
	}
	function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
		if (Array.isArray(keyNode)) {
			keyNode = Array.prototype.slice.call(keyNode);
			for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
				if (Array.isArray(keyNode[index])) throwError(state, "nested arrays are not supported inside keys");
				if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") keyNode[index] = "[object Object]";
			}
		}
		if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
		keyNode = String(keyNode);
		if (_result === null) _result = {};
		if (keyTag === "tag:yaml.org,2002:merge") {
			if (Array.isArray(valueNode)) {
				if (valueNode.length > 100) throwError(state, "abnormal merge sequence size");
				for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) mergeMappings(state, _result, valueNode[index], overridableKeys);
			} else mergeMappings(state, _result, valueNode, overridableKeys);
		} else {
			if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
				state.line = startLine || state.line;
				state.lineStart = startLineStart || state.lineStart;
				state.position = startPos || state.position;
				throwError(state, "duplicated mapping key");
			}
			setProperty(_result, keyNode, valueNode);
			delete overridableKeys[keyNode];
		}
		return _result;
	}
	function readLineBreak(state) {
		const ch = state.input.charCodeAt(state.position);
		if (ch === 10) state.position++;
		else if (ch === 13) {
			state.position++;
			if (state.input.charCodeAt(state.position) === 10) state.position++;
		} else throwError(state, "a line break is expected");
		state.line += 1;
		state.lineStart = state.position;
		state.firstTabInLine = -1;
	}
	function skipSeparationSpace(state, allowComments, checkIndent) {
		let lineBreaks = 0;
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			while (isWhiteSpace(ch)) {
				if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
				ch = state.input.charCodeAt(++state.position);
			}
			if (allowComments && ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 10 && ch !== 13 && ch !== 0);
			if (isEol(ch)) {
				readLineBreak(state);
				ch = state.input.charCodeAt(state.position);
				lineBreaks++;
				state.lineIndent = 0;
				while (ch === 32) {
					state.lineIndent++;
					ch = state.input.charCodeAt(++state.position);
				}
			} else break;
		}
		if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
		return lineBreaks;
	}
	function testDocumentSeparator(state) {
		let _position = state.position;
		let ch = state.input.charCodeAt(_position);
		if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
			_position += 3;
			ch = state.input.charCodeAt(_position);
			if (ch === 0 || isWsOrEol(ch)) return true;
		}
		return false;
	}
	function writeFoldedLines(state, count) {
		if (count === 1) state.result += " ";
		else if (count > 1) state.result += common2.repeat("\n", count - 1);
	}
	function readPlainScalar(state, nodeIndent, withinFlowCollection) {
		let captureStart;
		let captureEnd;
		let hasPendingContent;
		let _line;
		let _lineStart;
		let _lineIndent;
		const _kind = state.kind;
		const _result = state.result;
		let ch = state.input.charCodeAt(state.position);
		if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
		if (ch === 63 || ch === 45) {
			const following = state.input.charCodeAt(state.position + 1);
			if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) return false;
		}
		state.kind = "scalar";
		state.result = "";
		captureStart = captureEnd = state.position;
		hasPendingContent = false;
		while (ch !== 0) {
			if (ch === 58) {
				const following = state.input.charCodeAt(state.position + 1);
				if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) break;
			} else if (ch === 35) {
				if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
			} else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) break;
			else if (isEol(ch)) {
				_line = state.line;
				_lineStart = state.lineStart;
				_lineIndent = state.lineIndent;
				skipSeparationSpace(state, false, -1);
				if (state.lineIndent >= nodeIndent) {
					hasPendingContent = true;
					ch = state.input.charCodeAt(state.position);
					continue;
				} else {
					state.position = captureEnd;
					state.line = _line;
					state.lineStart = _lineStart;
					state.lineIndent = _lineIndent;
					break;
				}
			}
			if (hasPendingContent) {
				captureSegment(state, captureStart, captureEnd, false);
				writeFoldedLines(state, state.line - _line);
				captureStart = captureEnd = state.position;
				hasPendingContent = false;
			}
			if (!isWhiteSpace(ch)) captureEnd = state.position + 1;
			ch = state.input.charCodeAt(++state.position);
		}
		captureSegment(state, captureStart, captureEnd, false);
		if (state.result) return true;
		state.kind = _kind;
		state.result = _result;
		return false;
	}
	function readSingleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 39) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (ch === 39) {
				captureStart = state.position;
				state.position++;
				captureEnd = state.position;
			} else return true;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a single quoted scalar");
	}
	function readDoubleQuotedScalar(state, nodeIndent) {
		let captureStart;
		let captureEnd;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 34) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
			captureSegment(state, captureStart, state.position, true);
			state.position++;
			return true;
		} else if (ch === 92) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (isEol(ch)) skipSeparationSpace(state, false, nodeIndent);
			else if (ch < 256 && simpleEscapeCheck[ch]) {
				state.result += simpleEscapeMap[ch];
				state.position++;
			} else if ((tmp = escapedHexLen(ch)) > 0) {
				let hexLength = tmp;
				let hexResult = 0;
				for (; hexLength > 0; hexLength--) {
					ch = state.input.charCodeAt(++state.position);
					if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
					else throwError(state, "expected hexadecimal character");
				}
				state.result += charFromCodepoint(hexResult);
				state.position++;
			} else throwError(state, "unknown escape sequence");
			captureStart = captureEnd = state.position;
		} else if (isEol(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
		else {
			state.position++;
			if (!isWhiteSpace(ch)) captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a double quoted scalar");
	}
	function readFlowCollection(state, nodeIndent) {
		let readNext = true;
		let _line;
		let _lineStart;
		let _pos;
		const _tag = state.tag;
		let _result;
		const _anchor = state.anchor;
		let terminator;
		let isPair;
		let isExplicitPair;
		let isMapping;
		const overridableKeys = /* @__PURE__ */ Object.create(null);
		let keyNode;
		let keyTag;
		let valueNode;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 91) {
			terminator = 93;
			isMapping = false;
			_result = [];
		} else if (ch === 123) {
			terminator = 125;
			isMapping = true;
			_result = {};
		} else return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		ch = state.input.charCodeAt(++state.position);
		while (ch !== 0) {
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === terminator) {
				state.position++;
				state.tag = _tag;
				state.anchor = _anchor;
				state.kind = isMapping ? "mapping" : "sequence";
				state.result = _result;
				return true;
			} else if (!readNext) throwError(state, "missed comma between flow collection entries");
			else if (ch === 44) throwError(state, "expected the node content, but found ','");
			keyTag = keyNode = valueNode = null;
			isPair = isExplicitPair = false;
			if (ch === 63) {
				if (isWsOrEol(state.input.charCodeAt(state.position + 1))) {
					isPair = isExplicitPair = true;
					state.position++;
					skipSeparationSpace(state, true, nodeIndent);
				}
			}
			_line = state.line;
			_lineStart = state.lineStart;
			_pos = state.position;
			composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
			keyTag = state.tag;
			keyNode = state.result;
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if ((isExplicitPair || state.line === _line) && ch === 58) {
				isPair = true;
				ch = state.input.charCodeAt(++state.position);
				skipSeparationSpace(state, true, nodeIndent);
				composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
				valueNode = state.result;
			}
			if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
			else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
			else _result.push(keyNode);
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === 44) {
				readNext = true;
				ch = state.input.charCodeAt(++state.position);
			} else readNext = false;
		}
		throwError(state, "unexpected end of the stream within a flow collection");
	}
	function readBlockScalar(state, nodeIndent) {
		let folding;
		let chomping = CHOMPING_CLIP;
		let didReadContent = false;
		let detectedIndent = false;
		let textIndent = nodeIndent;
		let emptyLines = 0;
		let atMoreIndented = false;
		let tmp;
		let ch = state.input.charCodeAt(state.position);
		if (ch === 124) folding = false;
		else if (ch === 62) folding = true;
		else return false;
		state.kind = "scalar";
		state.result = "";
		while (ch !== 0) {
			ch = state.input.charCodeAt(++state.position);
			if (ch === 43 || ch === 45) {
				if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
				else throwError(state, "repeat of a chomping mode identifier");
			} else if ((tmp = fromDecimalCode(ch)) >= 0) {
				if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
				else if (!detectedIndent) {
					textIndent = nodeIndent + tmp - 1;
					detectedIndent = true;
				} else throwError(state, "repeat of an indentation width identifier");
			} else break;
		}
		if (isWhiteSpace(ch)) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (isWhiteSpace(ch));
			if (ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (!isEol(ch) && ch !== 0);
		}
		while (ch !== 0) {
			readLineBreak(state);
			state.lineIndent = 0;
			ch = state.input.charCodeAt(state.position);
			while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
				state.lineIndent++;
				ch = state.input.charCodeAt(++state.position);
			}
			if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
			if (isEol(ch)) {
				emptyLines++;
				continue;
			}
			if (!detectedIndent && textIndent === 0) throwError(state, "missing indentation for block scalar");
			if (state.lineIndent < textIndent) {
				if (chomping === CHOMPING_KEEP) state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
				else if (chomping === CHOMPING_CLIP) {
					if (didReadContent) state.result += "\n";
				}
				break;
			}
			if (folding) {
				if (isWhiteSpace(ch)) {
					atMoreIndented = true;
					state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
				} else if (atMoreIndented) {
					atMoreIndented = false;
					state.result += common2.repeat("\n", emptyLines + 1);
				} else if (emptyLines === 0) {
					if (didReadContent) state.result += " ";
				} else state.result += common2.repeat("\n", emptyLines);
			} else state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			didReadContent = true;
			detectedIndent = true;
			emptyLines = 0;
			const captureStart = state.position;
			while (!isEol(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
			captureSegment(state, captureStart, state.position, false);
		}
		return true;
	}
	function readBlockSequence(state, nodeIndent) {
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = [];
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			if (ch !== 45) break;
			if (!isWsOrEol(state.input.charCodeAt(state.position + 1))) break;
			detected = true;
			state.position++;
			if (skipSeparationSpace(state, true, -1)) {
				if (state.lineIndent <= nodeIndent) {
					_result.push(null);
					ch = state.input.charCodeAt(state.position);
					continue;
				}
			}
			const _line = state.line;
			composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
			_result.push(state.result);
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "sequence";
			state.result = _result;
			return true;
		}
		return false;
	}
	function readBlockMapping(state, nodeIndent, flowIndent) {
		let allowCompact;
		let _keyLine;
		let _keyLineStart;
		let _keyPos;
		const _tag = state.tag;
		const _anchor = state.anchor;
		const _result = {};
		const overridableKeys = /* @__PURE__ */ Object.create(null);
		let keyTag = null;
		let keyNode = null;
		let valueNode = null;
		let atExplicitKey = false;
		let detected = false;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) storeAnchor(state, state.anchor, _result);
		let ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (!atExplicitKey && state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			const following = state.input.charCodeAt(state.position + 1);
			const _line = state.line;
			if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
				if (ch === 63) {
					if (atExplicitKey) {
						storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
						keyTag = keyNode = valueNode = null;
					}
					detected = true;
					atExplicitKey = true;
					allowCompact = true;
				} else if (atExplicitKey) {
					atExplicitKey = false;
					allowCompact = true;
				} else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
				state.position += 1;
				ch = following;
			} else {
				_keyLine = state.line;
				_keyLineStart = state.lineStart;
				_keyPos = state.position;
				if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
				if (state.line === _line) {
					ch = state.input.charCodeAt(state.position);
					while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
					if (ch === 58) {
						ch = state.input.charCodeAt(++state.position);
						if (!isWsOrEol(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
						if (atExplicitKey) {
							storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
							keyTag = keyNode = valueNode = null;
						}
						detected = true;
						atExplicitKey = false;
						allowCompact = false;
						keyTag = state.tag;
						keyNode = state.result;
					} else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
					else {
						state.tag = _tag;
						state.anchor = _anchor;
						return true;
					}
				} else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
				else {
					state.tag = _tag;
					state.anchor = _anchor;
					return true;
				}
			}
			if (state.line === _line || state.lineIndent > nodeIndent) {
				if (atExplicitKey) {
					_keyLine = state.line;
					_keyLineStart = state.lineStart;
					_keyPos = state.position;
				}
				if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
					if (atExplicitKey) keyNode = state.result;
					else valueNode = state.result;
				}
				if (!atExplicitKey) {
					storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
					keyTag = keyNode = valueNode = null;
				}
				skipSeparationSpace(state, true, -1);
				ch = state.input.charCodeAt(state.position);
			}
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "mapping";
			state.result = _result;
		}
		return detected;
	}
	function readTagProperty(state) {
		let isVerbatim = false;
		let isNamed = false;
		let tagHandle;
		let tagName;
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 33) return false;
		if (state.tag !== null) throwError(state, "duplication of a tag property");
		ch = state.input.charCodeAt(++state.position);
		if (ch === 60) {
			isVerbatim = true;
			ch = state.input.charCodeAt(++state.position);
		} else if (ch === 33) {
			isNamed = true;
			tagHandle = "!!";
			ch = state.input.charCodeAt(++state.position);
		} else tagHandle = "!";
		let _position = state.position;
		if (isVerbatim) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 0 && ch !== 62);
			if (state.position < state.length) {
				tagName = state.input.slice(_position, state.position);
				ch = state.input.charCodeAt(++state.position);
			} else throwError(state, "unexpected end of the stream within a verbatim tag");
		} else {
			while (ch !== 0 && !isWsOrEol(ch)) {
				if (ch === 33) {
					if (!isNamed) {
						tagHandle = state.input.slice(_position - 1, state.position + 1);
						if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
						isNamed = true;
						_position = state.position + 1;
					} else throwError(state, "tag suffix cannot contain exclamation marks");
				}
				ch = state.input.charCodeAt(++state.position);
			}
			tagName = state.input.slice(_position, state.position);
			if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
		}
		if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
		try {
			tagName = decodeURIComponent(tagName);
		} catch (err) {
			throwError(state, "tag name is malformed: " + tagName);
		}
		if (isVerbatim) state.tag = tagName;
		else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
		else if (tagHandle === "!") state.tag = "!" + tagName;
		else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
		else throwError(state, "undeclared tag handle \"" + tagHandle + "\"");
		return true;
	}
	function readAnchorProperty(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 38) return false;
		if (state.anchor !== null) throwError(state, "duplication of an anchor property");
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
		state.anchor = state.input.slice(_position, state.position);
		return true;
	}
	function readAlias(state) {
		let ch = state.input.charCodeAt(state.position);
		if (ch !== 42) return false;
		ch = state.input.charCodeAt(++state.position);
		const _position = state.position;
		while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
		const alias = state.input.slice(_position, state.position);
		if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, "unidentified alias \"" + alias + "\"");
		state.result = state.anchorMap[alias];
		skipSeparationSpace(state, true, -1);
		return true;
	}
	function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
		const fallbackState = snapshotState(state);
		beginAnchorTransaction(state);
		restoreState(state, propertyStart);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
			commitAnchorTransaction(state);
			return true;
		}
		rollbackAnchorTransaction(state);
		restoreState(state, fallbackState);
		return false;
	}
	function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
		let allowBlockScalars;
		let allowBlockCollections;
		let indentStatus = 1;
		let atNewLine = false;
		let hasContent = false;
		let propertyStart = null;
		let type2;
		let flowIndent;
		let blockIndent;
		if (state.depth >= state.maxDepth) throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
		state.depth += 1;
		if (state.listener !== null) state.listener("open", state);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
		if (allowToSeek) {
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			}
		}
		if (indentStatus === 1) while (true) {
			const ch = state.input.charCodeAt(state.position);
			const propertyState = snapshotState(state);
			if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) break;
			if (!readTagProperty(state) && !readAnchorProperty(state)) break;
			if (propertyStart === null) propertyStart = propertyState;
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				allowBlockCollections = allowBlockStyles;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			} else allowBlockCollections = false;
		}
		if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
		if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
			if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
			else flowIndent = parentIndent + 1;
			blockIndent = state.position - state.lineStart;
			if (indentStatus === 1) {
				if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
				else {
					const ch = state.input.charCodeAt(state.position);
					if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(state, propertyStart, propertyStart.position - propertyStart.lineStart, flowIndent)) hasContent = true;
					else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
					else if (readAlias(state)) {
						hasContent = true;
						if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
					} else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
						hasContent = true;
						if (state.tag === null) state.tag = "?";
					}
					if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
				}
			} else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
		}
		if (state.tag === null) {
			if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
		} else if (state.tag === "?") {
			if (state.result !== null && state.kind !== "scalar") throwError(state, "unacceptable node kind for !<?> tag; it should be \"scalar\", not \"" + state.kind + "\"");
			for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
				type2 = state.implicitTypes[typeIndex];
				if (type2.resolve(state.result)) {
					state.result = type2.construct(state.result);
					state.tag = type2.tag;
					if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
					break;
				}
			}
		} else if (state.tag !== "!") {
			if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type2 = state.typeMap[state.kind || "fallback"][state.tag];
			else {
				type2 = null;
				const typeList = state.typeMap.multi[state.kind || "fallback"];
				for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
					type2 = typeList[typeIndex];
					break;
				}
			}
			if (!type2) throwError(state, "unknown tag !<" + state.tag + ">");
			if (state.result !== null && type2.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + "> tag; it should be \"" + type2.kind + "\", not \"" + state.kind + "\"");
			if (!type2.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
			else {
				state.result = type2.construct(state.result, state.tag);
				if (state.anchor !== null) storeAnchor(state, state.anchor, state.result);
			}
		}
		if (state.listener !== null) state.listener("close", state);
		state.depth -= 1;
		return state.tag !== null || state.anchor !== null || hasContent;
	}
	function readDocument(state) {
		const documentStart = state.position;
		let hasDirectives = false;
		let ch;
		state.version = null;
		state.checkLineBreaks = state.legacy;
		state.tagMap = /* @__PURE__ */ Object.create(null);
		state.anchorMap = /* @__PURE__ */ Object.create(null);
		while ((ch = state.input.charCodeAt(state.position)) !== 0) {
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if (state.lineIndent > 0 || ch !== 37) break;
			hasDirectives = true;
			ch = state.input.charCodeAt(++state.position);
			let _position = state.position;
			while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
			const directiveName = state.input.slice(_position, state.position);
			const directiveArgs = [];
			if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
			while (ch !== 0) {
				while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
				if (ch === 35) {
					do
						ch = state.input.charCodeAt(++state.position);
					while (ch !== 0 && !isEol(ch));
					break;
				}
				if (isEol(ch)) break;
				_position = state.position;
				while (ch !== 0 && !isWsOrEol(ch)) ch = state.input.charCodeAt(++state.position);
				directiveArgs.push(state.input.slice(_position, state.position));
			}
			if (ch !== 0) readLineBreak(state);
			if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
			else throwWarning(state, "unknown document directive \"" + directiveName + "\"");
		}
		skipSeparationSpace(state, true, -1);
		if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
			state.position += 3;
			skipSeparationSpace(state, true, -1);
		} else if (hasDirectives) throwError(state, "directives end mark is expected");
		composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
		skipSeparationSpace(state, true, -1);
		if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
		state.documents.push(state.result);
		if (state.position === state.lineStart && testDocumentSeparator(state)) {
			if (state.input.charCodeAt(state.position) === 46) {
				state.position += 3;
				skipSeparationSpace(state, true, -1);
			}
			return;
		}
		if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
	}
	function loadDocuments(input, options) {
		input = String(input);
		options = options || {};
		if (input.length !== 0) {
			if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
			if (input.charCodeAt(0) === 65279) input = input.slice(1);
		}
		const state = new State(input, options);
		const nullpos = input.indexOf("\0");
		if (nullpos !== -1) {
			state.position = nullpos;
			throwError(state, "null byte is not allowed in input");
		}
		state.input += "\0";
		while (state.input.charCodeAt(state.position) === 32) {
			state.lineIndent += 1;
			state.position += 1;
		}
		while (state.position < state.length - 1) readDocument(state);
		return state.documents;
	}
	function loadAll2(input, iterator, options) {
		if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
			options = iterator;
			iterator = null;
		}
		const documents = loadDocuments(input, options);
		if (typeof iterator !== "function") return documents;
		for (let index = 0, length = documents.length; index < length; index += 1) iterator(documents[index]);
	}
	function load2(input, options) {
		const documents = loadDocuments(input, options);
		if (documents.length === 0) return;
		else if (documents.length === 1) return documents[0];
		throw new YAMLException2("expected a single document in the stream, but found more");
	}
	loader.loadAll = loadAll2;
	loader.load = load2;
	return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
	if (hasRequiredDumper) return dumper;
	hasRequiredDumper = 1;
	const common2 = requireCommon();
	const YAMLException2 = requireException();
	const DEFAULT_SCHEMA2 = require_default();
	const _toString = Object.prototype.toString;
	const _hasOwnProperty = Object.prototype.hasOwnProperty;
	const CHAR_BOM = 65279;
	const CHAR_TAB = 9;
	const CHAR_LINE_FEED = 10;
	const CHAR_CARRIAGE_RETURN = 13;
	const CHAR_SPACE = 32;
	const CHAR_EXCLAMATION = 33;
	const CHAR_DOUBLE_QUOTE = 34;
	const CHAR_SHARP = 35;
	const CHAR_PERCENT = 37;
	const CHAR_AMPERSAND = 38;
	const CHAR_SINGLE_QUOTE = 39;
	const CHAR_ASTERISK = 42;
	const CHAR_COMMA = 44;
	const CHAR_MINUS = 45;
	const CHAR_COLON = 58;
	const CHAR_EQUALS = 61;
	const CHAR_GREATER_THAN = 62;
	const CHAR_QUESTION = 63;
	const CHAR_COMMERCIAL_AT = 64;
	const CHAR_LEFT_SQUARE_BRACKET = 91;
	const CHAR_RIGHT_SQUARE_BRACKET = 93;
	const CHAR_GRAVE_ACCENT = 96;
	const CHAR_LEFT_CURLY_BRACKET = 123;
	const CHAR_VERTICAL_LINE = 124;
	const CHAR_RIGHT_CURLY_BRACKET = 125;
	const ESCAPE_SEQUENCES = {};
	ESCAPE_SEQUENCES[0] = "\\0";
	ESCAPE_SEQUENCES[7] = "\\a";
	ESCAPE_SEQUENCES[8] = "\\b";
	ESCAPE_SEQUENCES[9] = "\\t";
	ESCAPE_SEQUENCES[10] = "\\n";
	ESCAPE_SEQUENCES[11] = "\\v";
	ESCAPE_SEQUENCES[12] = "\\f";
	ESCAPE_SEQUENCES[13] = "\\r";
	ESCAPE_SEQUENCES[27] = "\\e";
	ESCAPE_SEQUENCES[34] = "\\\"";
	ESCAPE_SEQUENCES[92] = "\\\\";
	ESCAPE_SEQUENCES[133] = "\\N";
	ESCAPE_SEQUENCES[160] = "\\_";
	ESCAPE_SEQUENCES[8232] = "\\L";
	ESCAPE_SEQUENCES[8233] = "\\P";
	const DEPRECATED_BOOLEANS_SYNTAX = [
		"y",
		"Y",
		"yes",
		"Yes",
		"YES",
		"on",
		"On",
		"ON",
		"n",
		"N",
		"no",
		"No",
		"NO",
		"off",
		"Off",
		"OFF"
	];
	const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
	function compileStyleMap(schema2, map2) {
		if (map2 === null) return {};
		const result = {};
		const keys = Object.keys(map2);
		for (let index = 0, length = keys.length; index < length; index += 1) {
			let tag = keys[index];
			let style = String(map2[tag]);
			if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
			const type2 = schema2.compiledTypeMap["fallback"][tag];
			if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) style = type2.styleAliases[style];
			result[tag] = style;
		}
		return result;
	}
	function encodeHex(character) {
		let handle;
		let length;
		const string = character.toString(16).toUpperCase();
		if (character <= 255) {
			handle = "x";
			length = 2;
		} else if (character <= 65535) {
			handle = "u";
			length = 4;
		} else if (character <= 4294967295) {
			handle = "U";
			length = 8;
		} else throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
		return "\\" + handle + common2.repeat("0", length - string.length) + string;
	}
	const QUOTING_TYPE_SINGLE = 1;
	const QUOTING_TYPE_DOUBLE = 2;
	function State(options) {
		this.schema = options["schema"] || DEFAULT_SCHEMA2;
		this.indent = Math.max(1, options["indent"] || 2);
		this.noArrayIndent = options["noArrayIndent"] || false;
		this.skipInvalid = options["skipInvalid"] || false;
		this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
		this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
		this.sortKeys = options["sortKeys"] || false;
		this.lineWidth = options["lineWidth"] || 80;
		this.noRefs = options["noRefs"] || false;
		this.noCompatMode = options["noCompatMode"] || false;
		this.condenseFlow = options["condenseFlow"] || false;
		this.quotingType = options["quotingType"] === "\"" ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
		this.forceQuotes = options["forceQuotes"] || false;
		this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
		this.implicitTypes = this.schema.compiledImplicit;
		this.explicitTypes = this.schema.compiledExplicit;
		this.tag = null;
		this.result = "";
		this.duplicates = [];
		this.usedDuplicates = null;
	}
	function indentString(string, spaces) {
		const ind = common2.repeat(" ", spaces);
		let position = 0;
		let result = "";
		const length = string.length;
		while (position < length) {
			let line;
			const next = string.indexOf("\n", position);
			if (next === -1) {
				line = string.slice(position);
				position = length;
			} else {
				line = string.slice(position, next + 1);
				position = next + 1;
			}
			if (line.length && line !== "\n") result += ind;
			result += line;
		}
		return result;
	}
	function generateNextLine(state, level) {
		return "\n" + common2.repeat(" ", state.indent * level);
	}
	function testImplicitResolving(state, str2) {
		for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) if (state.implicitTypes[index].resolve(str2)) return true;
		return false;
	}
	function isWhitespace(c) {
		return c === CHAR_SPACE || c === CHAR_TAB;
	}
	function isPrintable(c) {
		return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
	}
	function isNsCharOrWhitespace(c) {
		return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
	}
	function isPlainSafe(c, prev, inblock) {
		const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
		const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
		return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
	}
	function isPlainSafeFirst(c) {
		return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
	}
	function isPlainSafeLast(c) {
		return !isWhitespace(c) && c !== CHAR_COLON;
	}
	function codePointAt(string, pos) {
		const first = string.charCodeAt(pos);
		let second;
		if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
			second = string.charCodeAt(pos + 1);
			if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
		}
		return first;
	}
	function needIndentIndicator(string) {
		return /^\n* /.test(string);
	}
	const STYLE_PLAIN = 1;
	const STYLE_SINGLE = 2;
	const STYLE_LITERAL = 3;
	const STYLE_FOLDED = 4;
	const STYLE_DOUBLE = 5;
	function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
		let i;
		let char = 0;
		let prevChar = null;
		let hasLineBreak = false;
		let hasFoldableLine = false;
		const shouldTrackWidth = lineWidth !== -1;
		let previousLineBreak = -1;
		let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
		if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			if (!isPrintable(char)) return STYLE_DOUBLE;
			plain = plain && isPlainSafe(char, prevChar, inblock);
			prevChar = char;
		}
		else {
			for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
				char = codePointAt(string, i);
				if (char === CHAR_LINE_FEED) {
					hasLineBreak = true;
					if (shouldTrackWidth) {
						hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
						previousLineBreak = i;
					}
				} else if (!isPrintable(char)) return STYLE_DOUBLE;
				plain = plain && isPlainSafe(char, prevChar, inblock);
				prevChar = char;
			}
			hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
		}
		if (!hasLineBreak && !hasFoldableLine) {
			if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
			return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
		}
		if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
		if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
		return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
	}
	function writeScalar(state, string, level, iskey, inblock) {
		state.dump = (function() {
			if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"\"" : "''";
			if (!state.noCompatMode) {
				if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"" + string + "\"" : "'" + string + "'";
			}
			const indent = state.indent * Math.max(1, level);
			const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
			const singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
			function testAmbiguity(string2) {
				return testImplicitResolving(state, string2);
			}
			switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
				case STYLE_PLAIN: return string;
				case STYLE_SINGLE: return "'" + string.replace(/'/g, "''") + "'";
				case STYLE_LITERAL: return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
				case STYLE_FOLDED: return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
				case STYLE_DOUBLE: return "\"" + escapeString(string) + "\"";
				default: throw new YAMLException2("impossible error: invalid scalar style");
			}
		})();
	}
	function blockHeader(string, indentPerLevel) {
		const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
		const clip = string[string.length - 1] === "\n";
		return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
	}
	function dropEndingNewline(string) {
		return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
	}
	function foldString(string, width) {
		const lineRe = /(\n+)([^\n]*)/g;
		let result = (function() {
			let nextLF = string.indexOf("\n");
			nextLF = nextLF !== -1 ? nextLF : string.length;
			lineRe.lastIndex = nextLF;
			return foldLine(string.slice(0, nextLF), width);
		})();
		let prevMoreIndented = string[0] === "\n" || string[0] === " ";
		let moreIndented;
		let match;
		while (match = lineRe.exec(string)) {
			const prefix = match[1];
			const line = match[2];
			moreIndented = line[0] === " ";
			result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
			prevMoreIndented = moreIndented;
		}
		return result;
	}
	function foldLine(line, width) {
		if (line === "" || line[0] === " ") return line;
		const breakRe = / [^ ]/g;
		let match;
		let start = 0;
		let end;
		let curr = 0;
		let next = 0;
		let result = "";
		while (match = breakRe.exec(line)) {
			next = match.index;
			if (next - start > width) {
				end = curr > start ? curr : next;
				result += "\n" + line.slice(start, end);
				start = end + 1;
			}
			curr = next;
		}
		result += "\n";
		if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
		else result += line.slice(start);
		return result.slice(1);
	}
	function escapeString(string) {
		let result = "";
		let char = 0;
		for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			const escapeSeq = ESCAPE_SEQUENCES[char];
			if (!escapeSeq && isPrintable(char)) {
				result += string[i];
				if (char >= 65536) result += string[i + 1];
			} else result += escapeSeq || encodeHex(char);
		}
		return result;
	}
	function writeFlowSequence(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
				if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = "[" + _result + "]";
	}
	function writeBlockSequence(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		for (let index = 0, length = object.length; index < length; index += 1) {
			let value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
				if (!compact || _result !== "") _result += generateNextLine(state, level);
				if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
				else _result += "- ";
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = _result || "[]";
	}
	function writeFlowMapping(state, level, object) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (_result !== "") pairBuffer += ", ";
			if (state.condenseFlow) pairBuffer += "\"";
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level, objectKey, false, false)) continue;
			if (state.dump.length > 1024) pairBuffer += "? ";
			pairBuffer += state.dump + (state.condenseFlow ? "\"" : "") + ":" + (state.condenseFlow ? "" : " ");
			if (!writeNode(state, level, objectValue, false, false)) continue;
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = "{" + _result + "}";
	}
	function writeBlockMapping(state, level, object, compact) {
		let _result = "";
		const _tag = state.tag;
		const objectKeyList = Object.keys(object);
		if (state.sortKeys === true) objectKeyList.sort();
		else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
		else if (state.sortKeys) throw new YAMLException2("sortKeys must be a boolean or a function");
		for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
			let pairBuffer = "";
			if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
			const objectKey = objectKeyList[index];
			let objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
			const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
			if (explicitPair) {
				if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
				else pairBuffer += "? ";
			}
			pairBuffer += state.dump;
			if (explicitPair) pairBuffer += generateNextLine(state, level);
			if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
			if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
			else pairBuffer += ": ";
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = _result || "{}";
	}
	function detectType(state, object, explicit) {
		const typeList = explicit ? state.explicitTypes : state.implicitTypes;
		for (let index = 0, length = typeList.length; index < length; index += 1) {
			const type2 = typeList[index];
			if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
				if (explicit) {
					if (type2.multi && type2.representName) state.tag = type2.representName(object);
					else state.tag = type2.tag;
				} else state.tag = "?";
				if (type2.represent) {
					const style = state.styleMap[type2.tag] || type2.defaultStyle;
					let _result;
					if (_toString.call(type2.represent) === "[object Function]") _result = type2.represent(object, style);
					else if (_hasOwnProperty.call(type2.represent, style)) _result = type2.represent[style](object, style);
					else throw new YAMLException2("!<" + type2.tag + "> tag resolver accepts not \"" + style + "\" style");
					state.dump = _result;
				}
				return true;
			}
		}
		return false;
	}
	function writeNode(state, level, object, block, compact, iskey, isblockseq) {
		state.tag = null;
		state.dump = object;
		if (!detectType(state, object, false)) detectType(state, object, true);
		const type2 = _toString.call(state.dump);
		const inblock = block;
		if (block) block = state.flowLevel < 0 || state.flowLevel > level;
		const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
		let duplicateIndex;
		let duplicate;
		if (objectOrArray) {
			duplicateIndex = state.duplicates.indexOf(object);
			duplicate = duplicateIndex !== -1;
		}
		if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
		if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
		else {
			if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
			if (type2 === "[object Object]") {
				if (block && Object.keys(state.dump).length !== 0) {
					writeBlockMapping(state, level, state.dump, compact);
					if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
				} else {
					writeFlowMapping(state, level, state.dump);
					if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
				}
			} else if (type2 === "[object Array]") {
				if (block && state.dump.length !== 0) {
					if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
					else writeBlockSequence(state, level, state.dump, compact);
					if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
				} else {
					writeFlowSequence(state, level, state.dump);
					if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
				}
			} else if (type2 === "[object String]") {
				if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
			} else if (type2 === "[object Undefined]") return false;
			else {
				if (state.skipInvalid) return false;
				throw new YAMLException2("unacceptable kind of an object to dump " + type2);
			}
			if (state.tag !== null && state.tag !== "?") {
				let tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
				if (state.tag[0] === "!") tagStr = "!" + tagStr;
				else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
				else tagStr = "!<" + tagStr + ">";
				state.dump = tagStr + " " + state.dump;
			}
		}
		return true;
	}
	function getDuplicateReferences(object, state) {
		const objects = [];
		const duplicatesIndexes = [];
		inspectNode(object, objects, duplicatesIndexes);
		const length = duplicatesIndexes.length;
		for (let index = 0; index < length; index += 1) state.duplicates.push(objects[duplicatesIndexes[index]]);
		state.usedDuplicates = new Array(length);
	}
	function inspectNode(object, objects, duplicatesIndexes) {
		if (object !== null && typeof object === "object") {
			const index = objects.indexOf(object);
			if (index !== -1) {
				if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
			} else {
				objects.push(object);
				if (Array.isArray(object)) for (let i = 0, length = object.length; i < length; i += 1) inspectNode(object[i], objects, duplicatesIndexes);
				else {
					const objectKeyList = Object.keys(object);
					for (let i = 0, length = objectKeyList.length; i < length; i += 1) inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
				}
			}
		}
	}
	function dump2(input, options) {
		options = options || {};
		const state = new State(options);
		if (!state.noRefs) getDuplicateReferences(input, state);
		let value = input;
		if (state.replacer) value = state.replacer.call({ "": value }, "", value);
		if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
		return "";
	}
	dumper.dump = dump2;
	return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
	if (hasRequiredJsYaml) return jsYaml;
	hasRequiredJsYaml = 1;
	const loader2 = requireLoader();
	const dumper2 = requireDumper();
	function renamed(from, to) {
		return function() {
			throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
		};
	}
	jsYaml.Type = requireType();
	jsYaml.Schema = requireSchema();
	jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
	jsYaml.JSON_SCHEMA = requireJson();
	jsYaml.CORE_SCHEMA = requireCore();
	jsYaml.DEFAULT_SCHEMA = require_default();
	jsYaml.load = loader2.load;
	jsYaml.loadAll = loader2.loadAll;
	jsYaml.dump = dumper2.dump;
	jsYaml.YAMLException = requireException();
	jsYaml.types = {
		binary: requireBinary(),
		float: requireFloat(),
		map: requireMap(),
		null: require_null(),
		pairs: requirePairs(),
		set: requireSet(),
		timestamp: requireTimestamp(),
		bool: requireBool(),
		int: requireInt(),
		merge: requireMerge(),
		omap: requireOmap(),
		seq: requireSeq(),
		str: requireStr()
	};
	jsYaml.safeLoad = renamed("safeLoad", "load");
	jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
	jsYaml.safeDump = renamed("safeDump", "dump");
	return jsYaml;
}
const { Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump } = /* @__PURE__ */ getDefaultExportFromCjs(requireJsYaml());
// src/core/types.ts
/** Whitelist shared by the host write-validation and the client picker. */
const GROUP_COLORS = [
	"red",
	"orange",
	"amber",
	"green",
	"teal",
	"blue",
	"indigo",
	"purple",
	"pink",
	"gray"
];
/**
* Legacy label of the fallback bucket. The top-level (ungrouped) concept
* replaced the rendered "未分类" bucket: workspaces in no group render as
* top-level rows beside the group folders. The constant survives for data
* compatibility (reserved name, assignment null marker).
*/
const UNCATEGORIZED_LABEL = "未分类";
// src/core/matcher.ts
/** Display name of a rule category: the rename override when present. */
function ruleDisplayName(manual, originalName) {
	return manual?.renamed?.[originalName] ?? originalName;
}
// src/host-config.ts
/**
* Sidecar config reading for @dsh-xhl/workspace-groups. The classification rules
* live in a user-editable YAML file (default `~/.dsh/workspace-groups.yaml`),
* read and validated on the host, served to the browser half as JSON. The
* core workspace.json and session storage are never touched.
*/
/** Default sidecar location: `$DSH_HOME/workspace-groups.yaml` (DSH_HOME falls back to ~/.dsh). */
function defaultConfigPath() {
	const home = process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : resolve(homedir(), ".dsh");
	return resolve(home, "workspace-groups.yaml");
}
/** Parse + validate a raw sidecar document into a GroupsConfig (throws on malformed input). */
function parseGroupsConfig(raw) {
	if (raw === void 0 || raw === null) return { categories: [] };
	if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("workspace-groups.yaml: top-level value must be a mapping");
	const categoriesValue = raw.categories;
	const categories = [];
	if (categoriesValue === void 0) return { categories: [] };
	if (!Array.isArray(categoriesValue)) throw new Error("workspace-groups.yaml: categories must be a list");
	for (const entry of categoriesValue) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) throw new Error("workspace-groups.yaml: each category must be a mapping");
		const name = entry.name;
		if (typeof name !== "string" || name.trim() === "") throw new Error("workspace-groups.yaml: each category needs a non-empty name");
		const rulesValue = entry.rules;
		if (rulesValue === void 0) throw new Error(`workspace-groups.yaml: category "${name}" needs a rules list`);
		if (!Array.isArray(rulesValue)) throw new Error(`workspace-groups.yaml: category "${name}" rules must be a list`);
		const rules = [];
		for (const rule of rulesValue) {
			if (typeof rule !== "object" || rule === null || Array.isArray(rule)) throw new Error(`workspace-groups.yaml: category "${name}" rule must be a mapping`);
			const r = rule;
			const normalized = {};
			for (const key of [
				"pathPrefix",
				"nameContains",
				"basenameContains",
				"pathExact"
			]) {
				const value = r[key];
				if (value !== void 0) {
					if (typeof value !== "string" || value === "") throw new Error(`workspace-groups.yaml: category "${name}" rule ${key} must be a non-empty string`);
					normalized[key] = value;
				}
			}
			if (Object.keys(normalized).length === 0) throw new Error(`workspace-groups.yaml: category "${name}" has a rule with no matchers`);
			rules.push(normalized);
		}
		if (rules.length === 0) throw new Error(`workspace-groups.yaml: category "${name}" needs at least one rule`);
		categories.push({
			name: name.trim(),
			rules
		});
	}
	return { categories };
}
/**
* Read + parse the sidecar config file. A missing file yields an empty config
* (all workspaces fall into the uncategorized bucket); malformed YAML throws
* so the operator sees the problem instead of silently ungrouping everything.
*/
async function readGroupsConfig(path) {
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return { categories: [] };
		throw error;
	}
	return parseGroupsConfig(load(text));
}
// src/host-manual.ts
/**
* Runtime grouping overlay for @dsh-xhl/workspace-groups: manual groups created in
* the sidebar UI and per-workspace category overrides. Stored in a plugin-
* owned JSON sidecar (`$DSH_HOME/workspace-groups.manual.json`), separate from
* the operator YAML — the YAML stays the rule source, this file only records
* runtime decisions, and writes are atomic (temp file + fsync + rename).
*
* The browser PUT route writes the whole overlay (idempotent, last write
* wins); reads tolerate hand-edited content (parse-only) while the write
* boundary cross-validates against the current rule categories.
*/
/** Default overlay location: `$DSH_HOME/workspace-groups.manual.json`. */
function defaultManualPath() {
	const home = process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : resolve(homedir(), ".dsh");
	return resolve(home, "workspace-groups.manual.json");
}
/**
* Parse + shape-validate a raw overlay document into a ManualGroups.
* Validates types only — category references are checked against the rule set
* at the write boundary (validateManualGroups), because reads must tolerate
* files written while the rule set was different.
* @param raw - parsed JSON value.
* @returns the normalized overlay.
* @throws when the shape is malformed (non-mapping, bad names, duplicates,
* the reserved uncategorized label, bad assignment/order values).
*/
function parseManualGroups(raw) {
	if (raw === void 0 || raw === null) return {
		categories: [],
		assignments: {}
	};
	if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("workspace-groups.manual.json: top-level value must be a mapping");
	const source = raw;
	const categories = [];
	if (source.categories !== void 0) {
		if (!Array.isArray(source.categories)) throw new Error("workspace-groups.manual.json: categories must be a list");
		const seen = /* @__PURE__ */ new Set();
		for (const entry of source.categories) {
			if (typeof entry !== "string" || entry.trim() === "") throw new Error("workspace-groups.manual.json: each manual category must be a non-empty string");
			const name = entry.trim();
			if (name === "未分类") throw new Error(`workspace-groups.manual.json: manual category name "${name}" is reserved`);
			if (seen.has(name)) throw new Error(`workspace-groups.manual.json: duplicate manual category "${name}"`);
			seen.add(name);
			categories.push(name);
		}
	}
	const assignments = {};
	if (source.assignments !== void 0) {
		if (typeof source.assignments !== "object" || source.assignments === null || Array.isArray(source.assignments)) throw new Error("workspace-groups.manual.json: assignments must be a mapping");
		for (const [workspaceId, category] of Object.entries(source.assignments)) {
			if (workspaceId === "__proto__") continue;
			if (workspaceId.trim() === "") throw new Error("workspace-groups.manual.json: assignment keys must be non-empty");
			if (category === null) {
				assignments[workspaceId] = null;
				continue;
			}
			if (typeof category !== "string" || category.trim() === "") throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" must be a category name or null`);
			assignments[workspaceId] = category.trim();
		}
	}
	const manual = {
		categories,
		assignments
	};
	if (typeof source.revision === "number" && Number.isSafeInteger(source.revision) && source.revision >= 0) manual.revision = source.revision;
	if (source.categoryOrder !== void 0) manual.categoryOrder = parseStringList(source.categoryOrder, "categoryOrder", true);
	if (source.hidden !== void 0) manual.hidden = parseStringList(source.hidden, "hidden", true);
	if (source.renamed !== void 0) {
		if (typeof source.renamed !== "object" || source.renamed === null || Array.isArray(source.renamed)) throw new Error("workspace-groups.manual.json: renamed must be a mapping");
		const renamed = {};
		for (const [original, display] of Object.entries(source.renamed)) {
			if (original === "__proto__") continue;
			if (original.trim() === "") throw new Error("workspace-groups.manual.json: renamed keys must be non-empty");
			if (typeof display !== "string" || display.trim() === "") throw new Error(`workspace-groups.manual.json: renamed "${original}" must be a non-empty string`);
			renamed[original] = display.trim();
		}
		manual.renamed = renamed;
	}
	if (source.appearance !== void 0) {
		if (typeof source.appearance !== "object" || source.appearance === null || Array.isArray(source.appearance)) throw new Error("workspace-groups.manual.json: appearance must be a mapping");
		const appearance = {};
		for (const [key, value] of Object.entries(source.appearance)) {
			if (key === "__proto__") continue;
			if (key.trim() === "") throw new Error("workspace-groups.manual.json: appearance keys must be non-empty");
			const parsed = parseAppearance(value, key);
			if (parsed !== void 0) appearance[key.trim()] = parsed;
		}
		if (Object.keys(appearance).length > 0) manual.appearance = appearance;
	}
	if (source.workspaceOrder !== void 0) {
		if (typeof source.workspaceOrder !== "object" || source.workspaceOrder === null || Array.isArray(source.workspaceOrder)) throw new Error("workspace-groups.manual.json: workspaceOrder must be a mapping");
		const workspaceOrder = {};
		for (const [categoryKey, ids] of Object.entries(source.workspaceOrder)) {
			if (categoryKey === "__proto__") continue;
			if (categoryKey.trim() === "") throw new Error("workspace-groups.manual.json: workspaceOrder keys must be non-empty");
			workspaceOrder[categoryKey] = parseStringList(ids, `workspaceOrder["${categoryKey}"]`, true);
		}
		manual.workspaceOrder = workspaceOrder;
	}
	return manual;
}
/** Preset icon ids are lowercase kebab-case; anything else must be a short glyph. */
const ICON_PATTERN = /^(?:[a-z][a-z0-9-]{0,23}|[^\s\u0000-\u001f\u007f]{1,4})$/u;
/** Narrow an unknown value to a palette id from the shared whitelist. */
function isGroupColor(value) {
	return GROUP_COLORS.some((color) => color === value);
}
/**
* Parse one appearance entry. Unknown sub-keys are dropped; an entry that ends
* up empty is dropped entirely (returns undefined) so the file stays minimal.
*/
function parseAppearance(value, key) {
	const field = `appearance["${key}"]`;
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`workspace-groups.manual.json: ${field} must be an object`);
	const source = value;
	const appearance = {};
	if (source.color !== void 0) {
		if (!isGroupColor(source.color)) throw new Error(`workspace-groups.manual.json: ${field}.color must be one of: ${GROUP_COLORS.join(", ")}`);
		appearance.color = source.color;
	}
	if (source.icon !== void 0) {
		const icon = typeof source.icon === "string" ? source.icon.trim() : "";
		if (icon === "" || !ICON_PATTERN.test(icon)) throw new Error(`workspace-groups.manual.json: ${field}.icon must be an icon id or a 1–4 character glyph`);
		appearance.icon = icon;
	}
	if (source.pinned !== void 0) {
		if (typeof source.pinned !== "boolean") throw new Error(`workspace-groups.manual.json: ${field}.pinned must be a boolean`);
		if (source.pinned) appearance.pinned = true;
	}
	return Object.keys(appearance).length === 0 ? void 0 : appearance;
}
/** Parse a list of non-empty strings, optionally de-duplicated. */
function parseStringList(value, field, unique) {
	if (!Array.isArray(value)) throw new Error(`workspace-groups.manual.json: ${field} must be a list`);
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const entry of value) {
		if (typeof entry !== "string" || entry.trim() === "") throw new Error(`workspace-groups.manual.json: ${field} entries must be non-empty strings`);
		const trimmed = entry.trim();
		if (unique && seen.has(trimmed)) throw new Error(`workspace-groups.manual.json: ${field} has duplicate entry "${trimmed}"`);
		seen.add(trimmed);
		result.push(trimmed);
	}
	return result;
}
/**
* Cross-validate a parsed overlay against the current rule categories
* (write boundary only). Every assignment value must be `null`, a rule
* display name, a manual category name, or the uncategorized label; order
* keys must reference existing categories; renames/hides must reference
* actual rule categories.
* @param manual - parsed overlay.
* @param ruleCategoryNames - current YAML rule category original names.
* @throws when the overlay references categories that do not exist.
*/
function validateManualGroups(manual, ruleCategoryNames) {
	const ruleNames = new Set(ruleCategoryNames);
	const allowed = new Set(ruleCategoryNames.map((name) => ruleDisplayName(manual, name)));
	for (const name of manual.categories) allowed.add(name);
	allowed.add(UNCATEGORIZED_LABEL);
	for (const [workspaceId, category] of Object.entries(manual.assignments)) {
		if (category === null) continue;
		if (!allowed.has(category)) throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" references unknown category "${category}"`);
	}
	for (const key of manual.categoryOrder ?? []) if (!allowed.has(key) || key === "未分类") throw new Error(`workspace-groups.manual.json: categoryOrder references unknown category "${key}"`);
	for (const key of Object.keys(manual.workspaceOrder ?? {})) {
		if (key === "__topLevel__") continue;
		if (!allowed.has(key) || key === "未分类") throw new Error(`workspace-groups.manual.json: workspaceOrder references unknown category "${key}"`);
	}
	for (const original of Object.keys(manual.renamed ?? {})) if (!ruleNames.has(original)) throw new Error(`workspace-groups.manual.json: renamed references unknown rule category "${original}"`);
	for (const original of manual.hidden ?? []) if (!ruleNames.has(original)) throw new Error(`workspace-groups.manual.json: hidden references unknown rule category "${original}"`);
}
/** Read + parse the overlay file. A missing file yields an empty overlay. */
async function readManualGroups(path) {
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return {
			categories: [],
			assignments: {}
		};
		throw error;
	}
	return parseManualGroups(JSON.parse(text));
}
/**
* Atomically replace the overlay file: write a same-directory temp file,
* fsync it, then rename over the target. A crash never leaves a torn JSON at
* the real path (readers see either the old or the new file).
* @param path - target file path.
* @param manual - overlay to persist.
*/
async function writeManualGroups(path, manual) {
	const json = `${JSON.stringify(manual, null, 2)}\n`;
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	const handle = await open(tmp, "w");
	try {
		await handle.writeFile(json, "utf8");
		await handle.sync();
	} catch (error) {
		await handle.close().catch(() => {});
		await unlink(tmp).catch(() => {});
		throw error;
	}
	await handle.close();
	try {
		await rename(tmp, path);
	} catch (error) {
		await unlink(tmp).catch(() => {});
		throw error;
	}
}
// src/host-tabs.ts
/**
* Host-side persistence for the session-tab strip.
*
* Why the host and not the browser: **browser storage is scoped to the origin,
* and the origin includes the PORT.** `dsh web` / `dsh test` / the desktop shell
* each pick a port, and a different port is a different origin, so BOTH
* `localStorage` and `sessionStorage` start empty on the next launch. A tab list
* kept there survives a reload only by luck (same port) and is lost on the next
* start.
*
* Host storage has no such problem: one JSON sidecar under `$DSH_HOME`, keyed by
* nothing but the plugin, so every port and every session reads the same file.
* That file IS the strip's memory — it is returned as-is, with no browser-session
* marker gating it.
*
* (An earlier version DID gate on a `sessionKey` kept in `sessionStorage`, to
* express "clear when the browser closes". That cannot work here: the marker is
* itself per-origin, so a port change erased it, the host saw an unfamiliar
* marker, and every restart silently discarded the user's tabs. Persistence the
* user can rely on beats a tidy-up nobody asked for.)
*
* Writes are atomic (temp file + fsync + rename), matching the manual overlay.
*/
/** Default location: `$DSH_HOME/workspace-groups.tabs.json`. */
function defaultTabsPath() {
	const home = process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : resolve(homedir(), ".dsh");
	return resolve(home, "workspace-groups.tabs.json");
}
/**
* Normalize one tab row (used by both the file reader and the PUT body check, so
* the two can never drift).
*
* @param entry - one element of a stored/`posted` `tabs` array.
* @returns the tab, or null when the row is unusable.
*/
function parsePersistedTab(entry) {
	if (typeof entry !== "object" || entry === null) return null;
	const row = entry;
	if (typeof row.sessionId !== "string" || row.sessionId === "") return null;
	if (typeof row.order !== "number" || !Number.isFinite(row.order)) return null;
	const pinned = row.pinned === true;
	const title = typeof row.title === "string" && row.title.trim() !== "" ? row.title.trim() : void 0;
	return {
		sessionId: row.sessionId,
		order: row.order,
		...pinned ? { pinned: true } : {},
		...title !== void 0 ? { title } : {}
	};
}
/**
* Parse + shape-validate a tabs document.
*
* Tolerant on purpose: this file is a display cache, so a malformed one must
* read as "no tabs" rather than break the strip. Individual bad rows are dropped
* and the rest kept. Unknown fields (such as the `sessionKey` an older build
* wrote) are ignored, so an existing file keeps working across the change.
*
* @param raw - parsed JSON value.
* @returns the normalized document, or null when it is unusable.
*/
function parseTabsDocument(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const source = raw;
	if (source.version !== 1 && source.version !== 2) return null;
	if (typeof source.order !== "number" || !Number.isFinite(source.order)) return null;
	if (!Array.isArray(source.tabs)) return null;
	const tabs = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of source.tabs) {
		const tab = parsePersistedTab(entry);
		if (tab === null) continue;
		if (seen.has(tab.sessionId)) continue;
		seen.add(tab.sessionId);
		tabs.push(tab);
	}
	return {
		version: 2,
		order: source.order,
		tabs
	};
}
/**
* Read the tabs document.
*
* A missing file is not an error (first run). A corrupt one is reported as null
* so the caller starts empty, and the next write repairs the file.
*
* @param path - sidecar path.
* @returns the document, or null when absent/unusable.
*/
async function readTabsDocument(path) {
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return null;
		throw error;
	}
	try {
		return parseTabsDocument(JSON.parse(text));
	} catch {
		return null;
	}
}
/**
* Write the tabs document atomically.
* @param path - sidecar path.
* @param document - document to store.
*/
async function writeTabsDocument(path, document) {
	await mkdir(dirname(path), { recursive: true });
	const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
	const body = `${JSON.stringify(document, null, 2)}\n`;
	const handle = await open(temp, "w");
	try {
		await handle.writeFile(body, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		await rename(temp, path);
	} catch (error) {
		await unlink(temp).catch(() => {});
		throw error;
	}
}
/**
* Build the document to persist.
* @param state - the client's current strip and its arrival counter.
* @returns the document to write.
*/
function documentForTabs(state) {
	const highest = state.tabs.reduce((max, tab) => Math.max(max, tab.order), 0);
	return {
		version: 2,
		order: Math.max(state.order, highest),
		tabs: [...state.tabs]
	};
}
// src/core/folders.ts
/** Canonical empty document, shared so callers need not allocate one each time. */
const EMPTY_FOLDERS_DOCUMENT = {
	version: 1,
	revision: 0,
	workspaces: {}
};
/** `C:\…` or `C:/…` — a drive-rooted Windows path. */
const WINDOWS_DRIVE$1 = /^[A-Za-z]:[\\/]/u;
/** `\\server\share` — a Windows UNC path. */
const WINDOWS_UNC$1 = /^\\\\/u;
/** True for both Windows path spellings accepted by the write validator. */
function isWindowsStyle(path) {
	return WINDOWS_DRIVE$1.test(path) || WINDOWS_UNC$1.test(path);
}
/**
* One path with trailing separators removed, spelling preserved (no case
* folding) — the form to STORE. A drive/UNC/root prefix keeps its separator.
* @param path - raw path.
*/
function withoutTrailingSeparator(path) {
	if (isWindowsStyle(path)) {
		let value = path.replaceAll("/", "\\");
		while (value.length > 3 && value.endsWith("\\")) value = value.slice(0, -1);
		return value;
	}
	let value = path;
	while (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);
	return value;
}
/**
* Comparison form of one path: trimmed, separator-normalized and, for Windows
* spellings, lower-cased (drive letters and file names are case-insensitive
* there). Trailing separators are dropped except for a drive/UNC/root prefix.
* @param path - raw path as stored or picked.
* @returns the canonical comparison form.
*/
function canonicalPath(path) {
	const trimmed = path.trim();
	const value = withoutTrailingSeparator(trimmed);
	return isWindowsStyle(trimmed) ? value.toLowerCase() : value;
}
/**
* Path equality: case-insensitive for Windows-style paths, tolerant of
* trailing separators, exact for POSIX paths.
* @param a - first path.
* @param b - second path.
*/
function samePath(a, b) {
	return canonicalPath(a) === canonicalPath(b);
}
// src/host-folders.ts
/**
* Folder overlay for @dsh-xhl/workspace-groups: the per-workspace list of
* EXTRA folders plus the designated root folder. Stored in a plugin-owned JSON
* sidecar (`$DSH_HOME/workspace-groups.folders.json`), next to the manual
* grouping overlay, because neither DSH core nor the YAML rule source knows
* about folders: core gives a workspace exactly one canonical directory and the
* YAML stays the classification source.
*
* Writes are strict (the browser PUT route validates the whole document before
* replacing it, atomically: temp file + fsync + rename) and reads tolerate
* hand-edited content (junk entries are dropped instead of thrown), for the
* same reason the manual overlay does: a stale or malformed sidecar must never
* freeze the tree.
*/
/** File name of the folder sidecar (also the stable error-text prefix). */
const FOLDERS_FILE_NAME = "workspace-groups.folders.json";
const FOLDER_PATH_LIMIT = 1024;
const REMOTE_PATH_LIMIT = 1024;
/** `C:\…` or `C:/…` — a drive-rooted Windows path. */
const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/u;
/** `\\server\share` — a Windows UNC path. */
const WINDOWS_UNC = /^\\\\/u;
/** `/…` — a POSIX absolute path. */
const POSIX_ABSOLUTE = /^\//u;
/** Default overlay location: `$DSH_HOME/workspace-groups.folders.json`. */
function defaultFoldersPath() {
	const home = process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? process.env.DSH_HOME : resolve(homedir(), ".dsh");
	return resolve(home, FOLDERS_FILE_NAME);
}
/**
* Local mirror root of `@zhangfengshun/dsh-remote-ssh`.
*
* That plugin registers every remote workspace as an ordinary DSH workspace
* whose canonical directory is a LOCAL mirror (`<homedir>/.dsh/remote-workspaces/
* <workspaceId>`) and keeps the real remote path in its own records. Telling the
* browser this base lets it treat such workspaces differently: their extra
* folders must be subdirectories of the mirror, because only those also exist on
* the remote side.
*
* The path is hardcoded there (not read from `DSH_HOME`), so it is hardcoded
* here too — a mismatch would silently disable the distinction.
*/
function defaultRemoteMirrorBase() {
	return resolve(homedir(), ".dsh", "remote-workspaces");
}
/**
* True when `path` is absolute in the host platform's spelling: a drive
* letter or UNC prefix on Windows, a leading slash elsewhere.
* @param path - candidate path.
*/
function isAbsoluteFolderPath(path) {
	return process.platform === "win32" ? WINDOWS_DRIVE.test(path) || WINDOWS_UNC.test(path) : POSIX_ABSOLUTE.test(path);
}
/** Validate a local path for the read-only remote hint endpoint. */
function validateRemoteHintPath(path) {
	if (typeof path === "string" && path.startsWith("\\\\")) throw new Error("remote hint path must not be a UNC path");
	if (typeof path !== "string" || path.length === 0 || path.length > 1024 || path.includes("\0") || !isAbsoluteFolderPath(path)) throw new Error("remote hint path must be an absolute host path without NUL, at most 1024 characters");
	return path;
}
/**
* Presence-only safety hint, never a trusted SSH connection or registration.
* lstat also treats dangling symlinks as hints without reading their targets.
* Only ENOENT is ignored: permissions and all other inspection failures must
* prevent callers from silently falling back to local operations.
*/
async function hasRemoteMarkerHint(path) {
	let directory = resolve(validateRemoteHintPath(path));
	for (;;) {
		try {
			await lstat(resolve(directory, ".remote-ssh.json"));
			return true;
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		const parent = dirname(directory);
		if (parent === directory) return false;
		directory = parent;
	}
}
/** Reject helper carrying the stable file-scoped message prefix. */
function invalid(detail) {
	throw new Error(`${FOLDERS_FILE_NAME}: ${detail}`);
}
/** Trim one optional free-form string field, dropping it when unusable. */
function optionalText(value, limit, fail) {
	if (value === void 0) return void 0;
	if (typeof value !== "string") {
		fail("member text fields must be strings");
		return;
	}
	const text = value.trim();
	if (text === "" || text.length > limit || text.includes("\0")) return void 0;
	return text;
}
/**
* Parse one workspace-backed ("member") folder.
*
* A member names a real DSH workspace whose own sidebar row is hidden while this
* entry lists it; the fields kept here are exactly what the browser needs to
* start a Session in that workspace and to label the row.
* @param value - raw member from the document.
* @param workspaceId - owning workspace id (used in messages and as a guard).
* @param folders - plain folder paths already accepted for this workspace.
* @param members - member folders already accepted for this workspace.
* @param fail - strict-mode reporter (throws) / tolerant no-op.
* @returns the normalized member, or undefined when unusable.
*/
function parseMember(value, workspaceId, folders, members, fail) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail("member folders must be objects");
		return;
	}
	const source = value;
	const rawPath = source.path;
	if (typeof rawPath !== "string") {
		fail("member folder path must be a string");
		return;
	}
	const path = rawPath.trim();
	if (path === "" || path.length > 1024 || path.includes("\0")) {
		fail(`member folder path must be 1-${FOLDER_PATH_LIMIT} characters without NUL`);
		return;
	}
	if (!isAbsoluteFolderPath(path)) {
		fail(`member folder path "${path}" must be absolute`);
		return;
	}
	if (path.split(/[\\/]/).some((segment) => segment === "." || segment === "..")) {
		fail(`member folder path "${path}" must not contain "." or ".." segments`);
		return;
	}
	if (folders.some((folder) => samePath(folder, path)) || members.some((member) => samePath(member.path, path))) {
		fail(`duplicate folder path "${path}"`);
		return;
	}
	const rawId = source.workspaceId;
	if (typeof rawId !== "string") {
		fail("member workspaceId must be a string");
		return;
	}
	const memberWorkspaceId = rawId.trim();
	if (memberWorkspaceId === "" || memberWorkspaceId.length > 200 || memberWorkspaceId.includes("\0")) {
		fail(`member workspaceId must be 1-200 characters without NUL`);
		return;
	}
	if (memberWorkspaceId === workspaceId) {
		fail("a workspace cannot be a member folder of itself");
		return;
	}
	const kind = source.kind;
	if (kind !== "local" && kind !== "remote") {
		fail("member kind must be \"local\" or \"remote\"");
		return;
	}
	const title = optionalText(source.title, FOLDER_PATH_LIMIT, fail);
	const keepTitle = title === void 0 ? {} : { title };
	if (kind === "local") return {
		path,
		workspaceId: memberWorkspaceId,
		kind,
		...keepTitle
	};
	const rawRemote = source.remotePath;
	if (typeof rawRemote !== "string") {
		fail("a remote member folder needs its remotePath");
		return;
	}
	const remotePath = rawRemote.trim();
	if (remotePath === "" || remotePath.length > 1024 || remotePath.includes("\0")) {
		fail(`member remotePath must be 1-${REMOTE_PATH_LIMIT} characters without NUL`);
		return;
	}
	const rawProfile = source.profileId;
	if (typeof rawProfile !== "string") {
		fail("a remote member folder needs its profileId");
		return;
	}
	const profileId = rawProfile.trim();
	if (profileId === "" || profileId.length > 200) {
		fail(`member profileId must be 1-200 characters`);
		return;
	}
	const recordId = optionalText(source.recordId, 200, fail);
	return {
		path,
		workspaceId: memberWorkspaceId,
		kind,
		remotePath,
		profileId,
		...recordId === void 0 ? {} : { recordId },
		...keepTitle
	};
}
/**
* Parse one workspace entry.
* @param value - raw entry from the document.
* @param workspaceId - owning workspace id (used in messages).
* @param strict - throw on the first problem, or drop junk and return undefined.
* @returns the normalized entry, or undefined when nothing usable remains.
*/
function parseFolderEntry(value, workspaceId, strict) {
	const fail = (detail) => {
		if (strict) invalid(`workspace "${workspaceId}": ${detail}`);
	};
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail("entry must be an object");
		return;
	}
	const source = value;
	if (source.folders === void 0) {
		fail("folders is required");
		return;
	}
	if (!Array.isArray(source.folders)) {
		fail("folders must be a list");
		return;
	}
	if (strict && source.folders.length > 32) invalid(`workspace "${workspaceId}": at most 32 folders`);
	const folders = [];
	for (const candidate of source.folders) {
		if (typeof candidate !== "string") {
			fail("folder paths must be strings");
			continue;
		}
		const path = candidate.trim();
		if (path === "") {
			fail("folder paths must be non-empty");
			continue;
		}
		if (path.includes("\0")) {
			fail(`folder path "${path}" contains a NUL character`);
			continue;
		}
		if (path.length > 1024) {
			fail(`folder path exceeds ${FOLDER_PATH_LIMIT} characters`);
			continue;
		}
		if (!isAbsoluteFolderPath(path)) {
			fail(`folder path "${path}" must be absolute`);
			continue;
		}
		if (path.split(/[\\/]/).some((segment) => segment === "." || segment === "..")) {
			fail(`folder path "${path}" must not contain "." or ".." segments`);
			continue;
		}
		if (folders.some((existing) => samePath(existing, path))) {
			fail(`duplicate folder path "${path}"`);
			continue;
		}
		if (folders.length >= 32) {
			fail(`at most 32 folders`);
			break;
		}
		folders.push(path);
	}
	const members = [];
	if (source.members !== void 0) {
		if (!Array.isArray(source.members)) fail("members must be a list");
		else {
			if (strict && source.members.length > 16) invalid(`workspace "${workspaceId}": at most 16 member folders`);
			for (const candidate of source.members) {
				const member = parseMember(candidate, workspaceId, folders, members, fail);
				if (member !== void 0) members.push(member);
				if (members.length >= 16) break;
			}
		}
	}
	let root;
	if (source.root !== void 0) {
		if (typeof source.root !== "string") fail("root must be a string");
		else {
			const candidate = source.root.trim();
			const member = [...folders, ...members.map((entry) => entry.path)].find((folder) => samePath(folder, candidate));
			if (member === void 0) fail(`root "${candidate}" must name one of folders`);
			else root = member;
		}
	}
	if (folders.length === 0 && members.length === 0 && root === void 0) return void 0;
	return {
		folders,
		...members.length === 0 ? {} : { members },
		...root === void 0 ? {} : { root }
	};
}
/**
* Tolerant reader: shape-normalizes whatever was on disk and drops unusable
* workspaces, folders and roots instead of throwing. A missing, non-mapping or
* unknown-version document yields the empty document.
* @param raw - parsed JSON value.
*/
function parseFoldersDocument(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return EMPTY_FOLDERS_DOCUMENT;
	const source = raw;
	if (source.version !== 1) return EMPTY_FOLDERS_DOCUMENT;
	const revision = readRevision(source.revision);
	if (typeof source.workspaces !== "object" || source.workspaces === null || Array.isArray(source.workspaces)) return {
		version: 1,
		revision,
		workspaces: {}
	};
	const workspaces = {};
	for (const [workspaceId, value] of Object.entries(source.workspaces)) {
		if (workspaceId.trim() === "" || workspaceId.length > 200) continue;
		if (workspaceId === "__proto__") continue;
		const entry = parseFolderEntry(value, workspaceId, false);
		if (entry !== void 0) workspaces[workspaceId] = entry;
	}
	return {
		version: 1,
		revision,
		workspaces
	};
}
/**
* The document's write counter: a non-negative safe integer, else 0. Tolerant
* on purpose — reads must survive hand-edited sidecars; the strict writer
* below rejects bad values instead of letting them through.
* @param value - the raw `revision` field.
*/
function readRevision(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
/**
* Strict writer-side validation. Every rule is enforced and the first problem
* throws, so the PUT route rejects instead of persisting a half-valid file.
* @param raw - parsed JSON value from the request body.
* @returns the normalized document to save.
* @throws when version, workspace ids, folder paths, duplicates or the root
* membership are wrong.
*/
function validateFoldersDocument(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) invalid("top-level value must be a mapping");
	const source = raw;
	if (source.version !== 1) invalid("version must be 1");
	if (typeof source.workspaces !== "object" || source.workspaces === null || Array.isArray(source.workspaces)) invalid("workspaces must be a mapping");
	if (source.revision !== void 0 && (typeof source.revision !== "number" || !Number.isSafeInteger(source.revision) || source.revision < 0)) invalid("revision must be a non-negative integer");
	const workspaces = {};
	for (const [workspaceId, value] of Object.entries(source.workspaces)) {
		if (workspaceId.trim() === "" || workspaceId.length > 200 || workspaceId === "__proto__") invalid(`workspace ids must be non-empty strings of at most 200 characters`);
		const entry = parseFolderEntry(value, workspaceId, true);
		if (entry !== void 0) workspaces[workspaceId] = entry;
	}
	return {
		version: 1,
		revision: readRevision(source.revision),
		workspaces
	};
}
/**
* Read + tolerate the overlay file. A missing or unreadable file yields the
* empty document: folders are a convenience, and a broken sidecar must not take
* the tree down with it.
* @param path - overlay file path.
*/
async function readFoldersDocument(path) {
	try {
		const text = await readFile(path, "utf8");
		return parseFoldersDocument(JSON.parse(text));
	} catch {
		return EMPTY_FOLDERS_DOCUMENT;
	}
}
/**
* Atomically replace the overlay file: write a same-directory temp file,
* fsync it, then rename over the target. A crash never leaves a torn JSON at
* the real path (readers see either the old or the new file).
* @param path - target file path.
* @param document - validated document to persist.
*/
async function writeFoldersDocument(path, document) {
	const json = `${JSON.stringify(document, null, 2)}\n`;
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	const handle = await open(tmp, "w");
	try {
		await handle.writeFile(json, "utf8");
		await handle.sync();
	} catch (error) {
		await handle.close().catch(() => {});
		await unlink(tmp).catch(() => {});
		throw error;
	}
	await handle.close();
	try {
		await rename(tmp, path);
	} catch (error) {
		await unlink(tmp).catch(() => {});
		throw error;
	}
}
// src/index.ts
/** Plugin identity for cordis.yml rows. */
const name = "workspace-groups-local";
/** Services required before mounting: the webserver route. */
const inject = ["webServer"];
/** Cap on the PUT body: the overlay is tiny; anything bigger is a client bug. */
const MAX_MANUAL_BODY_BYTES = 65536;
/** Error with an HTTP status, mapped to a plain-text 4xx/5xx response. */
var HttpError = class extends Error {
	status;
	constructor(status, message) {
		super(message);
		this.status = status;
	}
};
/**
* Shape-validate a PUT /tabs body.
*
* Returns null on a malformed payload rather than throwing, so the route can
* answer 400 without a try/catch around the parse. Individual bad tab rows are
* dropped (the strip is a display cache; one bad row must not reject a whole
* write), and duplicate session ids are collapsed to the first.
*
* @param raw - parsed request body.
* @returns the payload, or null when the envelope is unusable.
*/
function parseTabsPayload(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const source = raw;
	if (typeof source.order !== "number" || !Number.isFinite(source.order)) return null;
	if (!Array.isArray(source.tabs)) return null;
	const tabs = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of source.tabs) {
		const tab = parsePersistedTab(entry);
		if (tab === null) continue;
		if (seen.has(tab.sessionId)) continue;
		seen.add(tab.sessionId);
		tabs.push(tab);
	}
	return {
		order: source.order,
		tabs
	};
}
/** Write a plain-text error response with the given status. */
function writeError(res, status, message) {
	res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
	res.end(message);
}
/** Collect the request body as UTF-8 text, rejecting oversized bodies. */
async function readBody(req, limit) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > limit) throw new HttpError(413, "request body too large");
		chunks.push(buffer);
	}
	if (chunks.length === 0) throw new HttpError(400, "empty request body");
	return Buffer.concat(chunks).toString("utf8");
}
/** Plugin body: mount the config snapshot route and the overlay write route. */
function apply(ctx) {
	const configPath = defaultConfigPath();
	const manualPath = defaultManualPath();
	const tabsPath = defaultTabsPath();
	const foldersPath = defaultFoldersPath();
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/workspace-groups/config",
		handler: async (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				writeError(res, 405, "method not allowed");
				return;
			}
			let config;
			let manual;
			try {
				[config, manual] = await Promise.all([readGroupsConfig(configPath), readManualGroups(manualPath)]);
			} catch (error) {
				writeError(res, 500, `workspace-groups: failed to read config: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const body = JSON.stringify({
				...config,
				manual
			});
			res.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-cache",
				"Content-Length": Buffer.byteLength(body)
			});
			res.end(req.method === "HEAD" ? void 0 : body);
		}
	}), "@dsh-xhl/workspace-groups: /workspace-groups/config route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/workspace-groups/tabs",
		handler: async (req, res) => {
			if (req.method === "GET" || req.method === "HEAD") {
				let stored;
				try {
					stored = await readTabsDocument(tabsPath);
				} catch (error) {
					writeError(res, 500, `workspace-groups: failed to read tabs: ${error instanceof Error ? error.message : String(error)}`);
					return;
				}
				const body = JSON.stringify({ tabs: stored?.tabs ?? [] });
				res.writeHead(200, {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
					"Content-Length": Buffer.byteLength(body)
				});
				res.end(req.method === "HEAD" ? void 0 : body);
				return;
			}
			if (req.method !== "PUT") {
				writeError(res, 405, "method not allowed");
				return;
			}
			let raw;
			try {
				raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES));
			} catch (error) {
				writeError(res, error instanceof HttpError ? error.status : 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const parsed = parseTabsPayload(raw);
			if (parsed === null) {
				writeError(res, 400, "workspace-groups: malformed tabs payload");
				return;
			}
			try {
				await writeTabsDocument(tabsPath, documentForTabs(parsed));
			} catch (error) {
				writeError(res, 500, `workspace-groups: failed to write tabs: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const body = JSON.stringify({ ok: true });
			res.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"Content-Length": Buffer.byteLength(body)
			});
			res.end(body);
		}
	}), "@dsh-xhl/workspace-groups: /workspace-groups/tabs route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/workspace-groups/manual",
		handler: async (req, res) => {
			if (req.method !== "PUT") {
				writeError(res, 405, "method not allowed");
				return;
			}
			let raw;
			try {
				raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES));
			} catch (error) {
				writeError(res, error instanceof HttpError ? error.status : 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			let manual;
			try {
				manual = parseManualGroups(raw);
				const ruleConfig = (await readGroupsConfig(configPath)).categories;
				validateManualGroups(manual, ruleConfig.map((category) => category.name));
			} catch (error) {
				writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			let current;
			try {
				current = await readManualGroups(manualPath);
			} catch {
				current = {
					categories: [],
					assignments: {}
				};
			}
			if ((manual.revision ?? 0) !== (current.revision ?? 0)) {
				const body = JSON.stringify({ manual: current });
				res.writeHead(409, {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
					"Content-Length": Buffer.byteLength(body)
				});
				res.end(body);
				return;
			}
			const stored = {
				...manual,
				revision: (current.revision ?? 0) + 1
			};
			try {
				await writeManualGroups(manualPath, stored);
			} catch (error) {
				writeError(res, 500, `workspace-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const body = JSON.stringify({
				ok: true,
				manual: stored
			});
			res.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"Content-Length": Buffer.byteLength(body)
			});
			res.end(body);
		}
	}), "@dsh-xhl/workspace-groups: /workspace-groups/manual route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/workspace-groups/remote-hint",
		handler: async (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				writeError(res, 405, "method not allowed");
				return;
			}
			let path;
			try {
				path = validateRemoteHintPath(new URL(req.url ?? "", "http://localhost").searchParams.get("path"));
			} catch {
				writeError(res, 400, "workspace-groups: invalid remote hint path");
				return;
			}
			let remoteHint;
			try {
				remoteHint = await hasRemoteMarkerHint(path);
			} catch {
				writeError(res, 500, "workspace-groups: failed to inspect remote hint; local fallback is unsafe");
				return;
			}
			const body = JSON.stringify({ remoteHint });
			res.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"Content-Length": Buffer.byteLength(body)
			});
			res.end(req.method === "HEAD" ? void 0 : body);
		}
	}), "@dsh-xhl/workspace-groups: /workspace-groups/remote-hint route");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/workspace-groups/folders",
		handler: async (req, res) => {
			if (req.method === "GET" || req.method === "HEAD") {
				const document = await readFoldersDocument(foldersPath);
				const body = JSON.stringify({
					...document,
					remoteBase: defaultRemoteMirrorBase()
				});
				res.writeHead(200, {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
					"Content-Length": Buffer.byteLength(body)
				});
				res.end(req.method === "HEAD" ? void 0 : body);
				return;
			}
			if (req.method === "POST") {
				writeError(res, 410, "workspace-groups: remote marker creation is deprecated; use the registered remote workspace root");
				return;
			}
			if (req.method !== "PUT") {
				writeError(res, 405, "method not allowed");
				return;
			}
			let raw;
			try {
				raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES));
			} catch (error) {
				writeError(res, error instanceof HttpError ? error.status : 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			let document;
			try {
				document = validateFoldersDocument(raw);
			} catch (error) {
				writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const current = await readFoldersDocument(foldersPath);
			if ((document.revision ?? 0) !== (current.revision ?? 0)) {
				const body = JSON.stringify(current);
				res.writeHead(409, {
					"Content-Type": "application/json; charset=utf-8",
					"Cache-Control": "no-store",
					"Content-Length": Buffer.byteLength(body)
				});
				res.end(body);
				return;
			}
			const stored = {
				...document,
				revision: (current.revision ?? 0) + 1
			};
			try {
				await writeFoldersDocument(foldersPath, stored);
			} catch (error) {
				writeError(res, 500, `workspace-groups: failed to write folder overlay: ${error instanceof Error ? error.message : String(error)}`);
				return;
			}
			const body = JSON.stringify(stored);
			res.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
				"Content-Length": Buffer.byteLength(body)
			});
			res.end(body);
		}
	}), "@dsh-xhl/workspace-groups: /workspace-groups/folders route");
}
export { apply, inject, name };
