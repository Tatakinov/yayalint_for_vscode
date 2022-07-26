//A yaya syntax parser engine for linting
import exp = require('constants');
import * as fs from 'fs';
namespace yayalint_engine {
	namespace yaya_parser {
		export class define{
			private _name: string;
			private _value: string;
			constructor(name: string, value: string){
				this._name = name;
				this._value = value;
			}
		}
		export class gobal_define{
			private _name: string;
			private _value: string;
			constructor(name: string, value: string){
				this._name = name;
				this._value = value;
			}
		}
		export class expr{
			private _data: string;
			private _type: string="unknown";
			private _is_constexpr: boolean=false;
			private _possible_values: string[]=[];

			constructor(){
				this._data="";
			}

			public set_data(data: string){
				this._data = data;
			}
		}
		export class statement_if{
			private _condition: expr;
			private _true_statement: code_block;
			private _false_statement: code_block;
			constructor(){
				this._condition = new expr("");
				this._true_statement = new code_block();
				this._false_statement = new code_block();
			}

			public build_by_lines(lines: Array<string>, line_num: number): number{
				//returns the line number of the next line to be parsed
				let line = lines[line_num];
				//get the condition
				//e.g. if (a == b){}
				//or if (a == (b));a;
				let condition_start = line.indexOf("if");
				let condition_end = line.indexOf("{|;");
				let condition_str = line.substring(condition_start+3, condition_end);
				this._condition.set_data(condition_str);
				//get the true statement
				let true_statement_start = line.indexOf("{", condition_end);
			}
		}
		export type code_line= expr|code_block;
		export class code_block{
			private _codes: Array<code_line>;
			constructor(){
				this._codes = new Array<code_line>();
			}
			
			public build_by_lines(lines: Array<string>, line_num: number): number{
				//returns the line number of the next line to be parsed
				let i: number = line_num;
				while(i < lines.length){
					let line: string = lines[i];
					if(line.length == 0){
						i++;
						continue;
					}
					if(line[0] == '{'){
						let body: code_block = new code_block();
						i = body.build_by_lines(lines, i+1);
						this._codes.push(body);
					}
					else{
						let tempexpr: expr = new expr(line);
						this._codes.push(tempexpr);
					}
					i++;
					if(line[i] == '}'){
						return i;
					}
				}
				throw new Error("unexpected end of file");
			}
		}
		export class function_define{
			private _name: string;
			private _body: code_block;
			private _start_line: number;
			private _end_line: number;

			constructor(name: string, body: code_block, start_line: number, end_line: number){
				this._name = name;
				this._body = body;
				this._start_line = start_line;
				this._end_line = end_line;
			}
		}
	}
	export class Dicfile{
		private _file_name: string;
		private _file_content: string[]; //split by \n
		private _defines: Array<yaya_parser.define>;
		private _gobal_defines: Array<yaya_parser.gobal_define>;
		private _functions: Array<yaya_parser.function_define>;
		constructor(file_name: string, file_content: string[]){
			this._file_name = file_name;
			this._file_content = file_content;
			this._defines = new Array<yaya_parser.define>();
			this._gobal_defines = new Array<yaya_parser.gobal_define>();
			this._functions = new Array<yaya_parser.function_define>();
		}
		parse(){
			//for each line
			for(let i=0; i<this._file_content.length; i++){
				let line = this._file_content[i];
				//if line is line comment
				if(line.startsWith("//")){
					continue;
				}
				//if line is block comment
				if(line.startsWith("/*")){
					//find end of block comment (string that contains "*/")
					while(!line.includes("*/")){
						i++;
						line += this._file_content[i];
					}
					//remove any before "*/"
					line = line.substring(line.indexOf("*/")+2);
				}
				//if line ends with "\", append next line
				while(line.endsWith("\\")){
					i++;
					line = line.substring(0, line.length-1);
					line += this._file_content[i];
				}
				//if line is define (startsWith "#\s*define")
				if(line.startsWith("#\s*define")){
					let define_line = line.split("[ \t]");
					let define_name = define_line[1];
					let define_value = define_line[2];
					this._defines.push(new yaya_parser.define(define_name, define_value));
					continue;
				}
				//if line is gobal define (startsWith "#\s*gobaldefine")
				if(line.startsWith("#\s*gobaldefine")){
					let define_line = line.split("[ \t]");
					let define_name = define_line[1];
					let define_value = define_line[2];
					this._gobal_defines.push(new yaya_parser.gobal_define(define_name, define_value));
					continue;
				}
				//else, the line must be a function
				let function_name = line.split("[ \t]")[1];
				let function_begin_line = i;
				//find function name
				//function name not contains [ \t{}()//\n]
				//e.g. some_function{body}
				if(line.includes("{")){
					let function_body_begin_line = i;
					let function_body_end_line = -1;
				}
			}
		}
	}
	export class lint_result{}
	export class lint_data{
		private _dicorder: DicOrder;
		private _dicfiles: Array<Dicfile>;
		private _known_global_variables: Array<string>=[];
		private _lint_results: Array<lint_result>=[];
		constructor(dicorder: DicOrder){
			this._dicorder = dicorder;
			this._dicfiles = this._dicorder.readAllDic();
		}
		public UpdateKnownGlobalVariables(variables: Array<string>){
			this._known_global_variables = variables;
		}
	}
	//Configuration file reader
	export class DicOrder{
		//Array<string> of dic reading order
		private _dicOrder:string[];
		//Constructor
		constructor(dicOrder:string[]){
			this._dicOrder = dicOrder;
		}
		//add anoter DicOrder to the end of the dic order
		addDicOrder(dicOrder:DicOrder){
			this._dicOrder = this._dicOrder.concat(dicOrder._dicOrder);
		}
		//add a dic file to the end of the dic order
		addDic(dic:string){
			this._dicOrder.push(dic);
		}
		//readDic
		readDic(dic:string):Dicfile{
			let dicfile:Dicfile = new Dicfile(dic, fs.readFileSync(dic, 'utf8').split('\n|\r|\r\n'));
			return dicfile;
		}
		//read all dic files and return array of Dicfile
		readAllDic():Array<Dicfile>{
			let dicFiles:Array<Dicfile>=new Array<Dicfile>();
			for(let i:number=0;i<this._dicOrder.length;i++){
				let dicFile:Dicfile=this.readDic(this._dicOrder[i]);
				dicFiles.push(dicFile);
			}
			return dicFiles;
		}
	}
	export class ConfigurationFileReader {
		//base path
		private _basePath: string;
		//charset of the configuration file
		private _charset: BufferEncoding;
		//charset of the dic file
		private _dicCharset: BufferEncoding;
		//constructor
		constructor(basePath: string, charset: BufferEncoding = 'utf8', dicCharset: BufferEncoding = "utf8") {
			this._basePath = basePath;
			this._charset = charset;
			this._dicCharset = dicCharset;
		}
		public lineparser(line: string): DicOrder {
			let dicOrder: DicOrder = new DicOrder([]);
			//split the line by ,
			let words: string[] = line.split(",");
			//if the line is dic
			if (words[0] == "dic") {
				dicOrder.addDic(words[1]);
			}
			//if the line is dicdir
			else if (words[0] == "dicdir") {
				let dicDir: string = words[1];
				//if dicdir contains a file named "_loading_order.txt", read the file as dicdir config
				if(fs.existsSync(dicDir+"/_loading_order.txt")){
					let dicdirconfig_reader: ConfigurationFileReader = new ConfigurationFileReader(this._basePath+'/'+dicDir, this._charset);
					let dicOrder:DicOrder = dicdirconfig_reader.read("_loading_order.txt");
					dicOrder.addDicOrder(dicOrder);
				}
				//else, add all files in the dicdir to the end of the dic order
				//and if it contains any directory, recursive add it to the end of the dic order
				else{
					let files:string[] = fs.readdirSync(dicDir);
					for(let i:number = 0;i<files.length;i++){
						let file:string = files[i];
						if(fs.statSync(dicDir+"/"+file).isDirectory()){
							dicOrder.addDicOrder(this.lineparser("dicdir,"+dicDir+"/"+file));
						}
						else{
							//skip if the extension is bak or tmp
							if(file.substring(file.length-4)==".bak"||file.substring(file.length-4)==".tmp"){
								continue;
							}
							dicOrder.addDic(dicDir+"/"+file);
						}
					}
				}
			}
			//if the line is include (include another configuration file)
			else if (words[0] == "include") {
				let encoding=this._charset;
				//if words[2] is not empty, use it as encoding
				if(words[2]!="")
					encoding=words[2] as BufferEncoding;
				let includereader: ConfigurationFileReader = new ConfigurationFileReader(this._basePath, encoding, this._dicCharset);
				let dicOrder: DicOrder = includereader.read(words[1]);
				dicOrder.addDicOrder(dicOrder);
			}
			//if the line is includeEX (include another configuration file but needs to move base path of file operation)
			else if (words[0] == "includeEX") {
				let encoding=this._charset;
				//if words[2] is not empty, use it as encoding
				if(words[2]!="")
					encoding=words[2] as BufferEncoding;
				let includereader: ConfigurationFileReader = new ConfigurationFileReader(this._basePath+'/'+words[1]);
				let dicOrder: DicOrder = includereader.read(words[1]);
				dicOrder.addDicOrder(dicOrder);
			}
			return dicOrder;
		}
		//Reads the configuration file
		public read(filePath: string): DicOrder {
			filePath=this._basePath+filePath;
			//Read the file
			let fileContent: string = fs.readFileSync(filePath, this._charset);
			//Parse the file
			let lines: string[] = fileContent.split(`\n|\r|\r\n`);
			let dicOrder: DicOrder = new DicOrder([]);
			for (let i: number = 0; i < lines.length; i++) {
				let line: string = lines[i];
				//cut space
				line = line.trim();
				//skip if the line is empty
				if (line == "")
					continue;
				//skip if the line is comment
				if (line.substring(0, 1) == "//")
					continue;
				//skip block comment
				if (line.substring(0, 2) == "/*") {
					while (line.substring(line.length - 2) != "*/") {
						line = lines[++i];
					}
					continue;
				}
				dicOrder.addDicOrder(this.lineparser(line));
			}
			return dicOrder;
		}
	}
	export class DicdirConfigurationFileReader{
		//base path
		private _basePath: string;
		//charset of the configuration file
		private _charset: BufferEncoding;
		//charset of the dic file
		private _dicCharset: BufferEncoding;
		//constructor
		constructor(basePath: string, charset: BufferEncoding = 'utf8', dicCharset: BufferEncoding = "utf8") {
			this._basePath = basePath;
			this._charset = charset;
			this._dicCharset = dicCharset;
		}
		//Reads the configuration file
		public read(filepath:string):DicOrder{
			let configreader:ConfigurationFileReader = new ConfigurationFileReader(this._basePath,this._charset,this._dicCharset);
			return configreader.read(filepath);
		}
	}
}