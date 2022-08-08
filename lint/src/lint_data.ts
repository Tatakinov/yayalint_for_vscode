import * as fs from 'fs';
import * as Parser from './parser';

interface Range {
    start:Position;
    end:Position;
}
interface Position {
    line:number;
    column:number;
}

namespace yaya_parser {
	export class define{
		_name: string;
		_value: string;
		constructor(name: string, value: string){
			this._name = name;
			this._value = value;
		}
	}
	export class define_map{
		_data:Map<string,string> = new Map<string,string>();
		constructor(){}
		add(name: string, value: string){
			this._data.set(name,value);
		}
		add_define(define: define){
			this._data.set(define._name,define._value);
		}
		get_define_list(): Array<define>{
			let list: Array<define> = new Array<define>();
			this._data.forEach((value,key)=>{
				list.push(new define(key,value));
			}
			);
			return list;
		}
		get(name: string): string|undefined{
			return this._data.get(name);
		}
	}
	export class gobal_define{
		_name: string;
		_value: string;
		constructor(name: string, value: string){
			this._name = name;
			this._value = value;
		}
	}
	export class gobal_define_map{
		_data:Map<string,string> = new Map<string,string>();
		constructor(){}
		add(name: string, value: string){
			this._data.set(name,value);
		}
		add_define(define: gobal_define){
			this._data.set(define._name,define._value);
		}
		get_define_list(): Array<gobal_define>{
			let list: Array<gobal_define> = new Array<gobal_define>();
			this._data.forEach((value,key)=>{
				list.push(new define(key,value));
			}
			);
			return list;
		}
		get(name: string): string|undefined{
			return this._data.get(name);
		}
		marge(map: gobal_define_map):gobal_define_map{
			map._data.forEach((value,key)=>{
				this._data.set(key,value);
			}
			);
			return this;
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
			this._condition = new expr();
			this._true_statement = new code_block();
			this._false_statement = new code_block();
		}
	}
	export class statement_while{
		private _condition: expr;
		private _body: code_block;
	}
	export class statement_for{
		private _condition_init: expr;
		private _condition_condition: expr;
		private _condition_increment: expr;
		private _body: code_block;
	}
	export class statement_for_each{
		private _variable: string;
		private _array: expr;
		private _body: code_block;
	}
	export class statement_switch{
		private _codes: Array<code_line>;
	}
	export class statement_case{
		private _maps: Map<string, code_block>;
	}
	export type statements = statement_if | statement_while | statement_for | statement_switch | statement_case;
	export type code_line= expr|code_block|statements;
	export class code_block{
		private _choose_type: string="random";
		private _codes: Array<code_line>;
		constructor(){
			this._codes = new Array<code_line>();
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
	_file_name: string;
	_gobal_define_map_charge:yaya_parser.gobal_define_map;
	private _file_content: string[]; //split by \n
	private _defines: yaya_parser.define_map;
	private _gobal_defines: yaya_parser.gobal_define_map;
	private _functions: Array<yaya_parser.function_define>;
	constructor(file_name: string, file_content: string[]){
		this._file_name = file_name;
		this._file_content = file_content;
		this._defines = new yaya_parser.define_map();
		this._gobal_defines = new yaya_parser.gobal_define_map();
		this._functions = new Array<yaya_parser.function_define>();
	}
	public gobal_define_diff_with(dicfile: Dicfile): boolean{
		let another_gobal_defines: yaya_parser.gobal_define_map = dicfile._gobal_defines;
		//check if the two gobal defines are the same
		this._gobal_defines._data.forEach((value,key)=>{
				if(another_gobal_defines._data.get(key)!=value){
					return true;
				}
			}
		);
		return false;
	}
	public re_parse(gobal_define_map:yaya_parser.gobal_define_map):yaya_parser.gobal_define_map{
		let file_content: string = '';
		// pre process
		let line_number	= 1;
		for (const line of this._file_content) {
			// TODO considering here document and string
			if (line.startsWith('#define')) {
				let position = 7;
				let tmp = line.substring(position);
				position = tmp.search(/[^ \t　]/);
				tmp = tmp.substring(position);
				position = tmp.search(/ |\t|　/);
				const key = tmp.substring(0, position - 1);
				tmp = tmp.substring(position);
				const value = tmp.substring(tmp.search(/[^ \t　]/));
				this._defines.add(key, value);
				file_content += '\n';
			}
			else if (line.startsWith('#globaldefine')) {
				let position = 13;
				let tmp = line.substring(position);
				position = tmp.search(/[^ \t　]/);
				tmp = tmp.substring(position);
				position = tmp.search(/ |\t|　/);
				const key = tmp.substring(0, position - 1);
				tmp = tmp.substring(position);
				const value = tmp.substring(tmp.search(/[^ \t　]/));
				this._gobal_defines.add(key, value);
				gobal_define_map.add(key, value);
				file_content += '\n';
			}
			else {
				let tmp = line;
				tmp = tmp.replace(/__AYA_SYSTEM_FILE__/, this._file_name);
				tmp = tmp.replace(/__AYA_SYSTEM_LINE__/, line_number.toString());
				// replace define
				for (const define of this._defines.get_define_list()) {
					tmp = tmp.replace(define._name, define._value);
				}
				// replace globaldefine
				for (const define of gobal_define_map.get_define_list()) {
					tmp = tmp.replace(define._name, define._value);
				}
				file_content += tmp + '\n';
			}
			line_number++;
		}
		//parse
		let parser: Parser.Parser = new Parser.Parser(file_content);
		let parser_result: Parser.ParseResult = parser.parse();
		//parse gobal | not gobal defines
		
		//TODO re_parse
		this._gobal_define_map_charge = gobal_define_map;
		return this._gobal_define_map_charge;
	}
}
export class lint_result{}
export class lint_data{
	private _dicorder: DicOrder=new DicOrder();
	private _dicfiles: Array<Dicfile>=new Array<Dicfile>();
	private _known_global_variables: Array<string>=[];
	private _lint_results: Array<lint_result>=[];
	constructor(){
	}

	public init_form_dic_order(dicorder: DicOrder){
		this._dicorder = dicorder;
		this._dicfiles = dicorder.readAllDic();
	}
	public UpdateKnownGlobalVariables(variables: Array<string>){
		this._known_global_variables = variables;
	}
	public UpdateSpecificDicFile(dicfile_name: string, dicfile_content: string[]){
		//if this dicfile is not in the dicorder, then add it
		if(this._dicorder.hasDic(dicfile_name)==null){
			this._dicorder.addDic(dicfile_name);
		}
		else{
			//if this dicfile is in the dicorder, then update it
			let new_dicfile: Dicfile = new Dicfile(dicfile_name, dicfile_content);
			let index: number = this._dicorder.getDicIndex(dicfile_name);
			let old_dicfile: Dicfile = this._dicfiles[index];
			//if this dicfile was changed gobaldefines, then we need update all dic files after this dicfile
			if(old_dicfile.gobal_define_diff_with(new_dicfile)){
				if(index!=0)
					new_dicfile._gobal_define_map_charge = this._dicfiles[index-1]._gobal_define_map_charge;
				new_dicfile.re_parse(new_dicfile._gobal_define_map_charge);
				this._dicfiles[index]=new_dicfile;
				//update all dic files after this dicfile
				for(let i=index+1;i<this._dicfiles.length;i++){
					this._dicfiles[i].re_parse(this._dicfiles[i-1]._gobal_define_map_charge);
				}
			}
		}
	}
	public UpdateDicOrder(dicorder: DicOrder){
		this._dicorder = dicorder;
		//Find the first position where the order is diff and update all dic's after that
		let index: number = 0;
		for(let i=0;i<this._dicfiles.length;i++){
			if(this._dicorder.hasDic(this._dicfiles[i]._file_name)==null){
				index = i;
				break;
			}
		}
		if(index==0)
			this._dicfiles[0].re_parse(new yaya_parser.gobal_define_map());
		for(let i=index;i<this._dicfiles.length;i++){
			this._dicfiles[i].re_parse(this._dicfiles[i-1]._gobal_define_map_charge);
		}
	}
	public re_lint(){
		//TODO re_lint
	}
	public get_lint_results(): Array<lint_result>{
		return this._lint_results;
	}
}
//readDic
function readDic(dic:string):Dicfile{
	let dicfile:Dicfile = new Dicfile(dic, fs.readFileSync(dic, 'utf8').split('\n|\r|\r\n'));
	return dicfile;
}
//Configuration file reader
export class DicOrder{
	//Array<string> of dic reading order
	private _dicOrder:string[]=[];
	//Constructor
	constructor(){
	}
	//add anoter DicOrder to the end of the dic order
	addDicOrder(dicOrder:DicOrder){
		this._dicOrder = this._dicOrder.concat(dicOrder._dicOrder);
	}
	//add a dic file to the end of the dic order
	addDic(dic:string){
		this._dicOrder.push(dic);
	}
	//read all dic files and return array of Dicfile
	readAllDic():Array<Dicfile>{
		let dicFiles:Array<Dicfile>=new Array<Dicfile>();
		for(let i:number=0;i<this._dicOrder.length;i++){
			let dicFile:Dicfile=readDic(this._dicOrder[i]);
			dicFiles.push(dicFile);
		}
		return dicFiles;
	}
	//has this dic file
	hasDic(dic:string):boolean{
		for(let i:number=0;i<this._dicOrder.length;i++){
			if(this._dicOrder[i]==dic){
				return true;
			}
		}
		return false;
	}
	//get the index of this dic file
	getDicIndex(dic:string):number{
		for(let i:number=0;i<this._dicOrder.length;i++){
			if(this._dicOrder[i]==dic){
				return i;
			}
		}
		return -1;
	}
	//get dic list after this dic file
	getDicListAfter(dic:string):Array<string>{
		let dicList:Array<string>=[];
		for(let i:number=0;i<this._dicOrder.length;i++){
			if(this._dicOrder[i]==dic){
				for(let j:number=i+1;j<this._dicOrder.length;j++){
					dicList.push(this._dicOrder[j]);
				}
				break;
			}
		}
		return dicList;
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
		let dicOrder: DicOrder = new DicOrder();
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
		let dicOrder: DicOrder = new DicOrder();
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