//A yaya syntax parser engine for linting
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
			private _type: string;
			private _is_constexpr: boolean=false;
			private _possible_values: string[]=[];

			constructor(data: string, type: string){
				this._data = data;
				this._type = type;
			}
		}
		export class code_block{
			private _codes: Array<expr|code_block>;
			constructor(){
				this._codes = new Array<expr|code_block>();
			}
		}
		export class function_define{
			private _name: string;
			private _body: code_block;

			constructor(name: string, body: code_block){
				this._name = name;
				this._body = body;
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
		//read all dic files
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