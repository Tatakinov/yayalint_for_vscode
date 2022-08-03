import * as yayalint_engine from './lint_data';

var lint_data: yayalint_engine.lint_data = new yayalint_engine.lint_data();

// init lint_data
export function init_linter(basefile: string,basePath: string){
    let ConfigurationFileReader: yayalint_engine.ConfigurationFileReader= new yayalint_engine.ConfigurationFileReader(basePath);
    let dicOrder: yayalint_engine.DicOrder= ConfigurationFileReader.read(basefile);
    lint_data.init_form_dic_order(dicOrder);
}

// This function occurs when a variable file is modified or when it is first read in
export function update_known_global_variables(variables: Array<string>){
    lint_data.UpdateKnownGlobalVariables(variables);
}

// This function occurs when a dictionary file is modified
export function update_specific_dic_file(dic_file: string,data: string[]){
    lint_data.UpdateSpecificDicFile(dic_file,data);
}

// This function occurs when dic order file is modified, or dic file is added or removed
export function update_dic_order(basefile: string,basePath: string){
    let ConfigurationFileReader: yayalint_engine.ConfigurationFileReader= new yayalint_engine.ConfigurationFileReader(basePath);
    let dicOrder: yayalint_engine.DicOrder= ConfigurationFileReader.read(basefile);
    lint_data.UpdateDicOrder(dicOrder);
}

export function get_lint_results(){
    return lint_data.get_lint_results();
}
