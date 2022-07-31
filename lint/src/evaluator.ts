import * as Parser from './parser';

export type AnalysisResultType = 'UnusedVariable' | 'UndefinedVariable' |
    'UnusedFunction' | 'UndefinedFunction'

type TreatmentType  = 'read' | 'write'

interface VariableState {
    read:Range | null;
    write:Range | null;
}

interface AnalysisResultData {
    type:AnalysisResultType;
    filename:string;
    range:Range;
}

interface Range {
    start:Position;
    end:Position;
}

interface Position {
    line:number;
    column:number;
}

interface AnalysisData {
    filename:string;
    preprocess:boolean;
    global_var:Map<string,VariableState>;
    local_var:Map<string,VariableState>;
    in_condition:boolean;
    compare_in_condition:boolean;
    variable_treatment:TreatmentType;
    result:AnalysisResultData[];
}

export function evaluate(file_list:string[], cache:Map<string, string>) {
    const global_variable = new Map<string, VariableState>();
    let result:AnalysisResultData[] = [];
    for (const file of file_list) {
        evaluateInternal(file, cache.get(file)!, global_variable, true);
    }
    for (const file of file_list) {
        const tmp = evaluateInternal(file, cache.get(file)!, global_variable, false);
        for (const elem of tmp) {
            result.push(elem);
        }
    }
    return result;
}

function evaluateInternal(filename:string, input:string, global_variable:Map<string,VariableState>, preprocess:boolean) : AnalysisResultData[] {
    const result:AnalysisResultData[] = [];
    const p = new Parser.Parser(input);
    const tree  = p.parse();
    if (tree.ast) {
        const data:AnalysisData = {
            filename: filename,
            preprocess: preprocess,
            global_var: global_variable,
            local_var: new Map<string,VariableState>(),
            in_condition: false,
            compare_in_condition: false,
            variable_treatment: "read",
            result: result
        }
        evalGrammar(tree.ast, data);
    }
    else {
        //TODO stub
        console.log('' + tree.errs);
    }
    return result;
}

function evalNL(ast:Parser.NL) {
    return ast.ch;
}

function evalChar(ast:Parser.Char) {
    return ast.ch;
}

function evalNumberZ(ast:Parser.NumberZ) {
    if (ast.sign) {
        return ast.sign + ast.num;
    }
    return ast.num;
}

function evalNumberF(ast:Parser.NumberF) {
    return ast.v.reduce((p, c) => {
        return p + c;
    }, '.')
}

function evalNumberR(ast:Parser.NumberR) {
    if (ast.float) {
        return evalNumberZ(ast.num) + evalNumberF(ast.float);
    }
    return evalNumberZ(ast.num);
}

function evalNumberX(ast:Parser.NumberX) {
    const v = ast.v.reduce((p, c) => {
        return p + c;
    }, '0x');
    if (ast.sign) {
        return ast.sign + v;
    }
    return v;
}

function evalNumberRX(ast:Parser.NumberRX) {
    if (ast.kind === Parser.ASTKinds.NumberRX_1) {
        return evalNumberX(ast.num);
    }
    if (ast.kind === Parser.ASTKinds.NumberRX_2) {
        return evalNumberR(ast.num);
    }
}

function evalNumber(ast:Parser.Number) {
    evalNumberRX(ast);
}

function evalEmpty(ast:Parser.Empty, data:AnalysisData) {
}

function evalValidNameChar(ast:Parser.ValidNameChar) {
    return evalChar(ast.ch);
}

function evalNameStartNumber(ast:Parser.NameStartNumber) {
    return ast.num.reduce((p, c) => {
        return p + c;
    }, '') + ast.name.reduce((p, c) => {
        return p + evalValidNameChar(c);
    }, '');
}

function evalNameStartChar(ast:Parser.NameStartChar) {
    return ast.name.reduce((p, c) => {
        return p + evalValidNameChar(c);
    }, '');
}

function evalName(ast:Parser.Name) {
    switch (ast.kind) {
        case Parser.ASTKinds.Name_1: {
            return evalNameStartNumber(ast.num);
            break;
        }
        case Parser.ASTKinds.Name_2: {
            return evalNameStartChar(ast.ch);
            break;
        }
    }
}

function evalLocalVariable(ast:Parser.LocalVariable, data:AnalysisData) {
    const name  = '_' + evalName(ast.name);
    if ( ! data.local_var.has(name)) {
        data.local_var.set(name, {
            read: null,
            write: null
        });
    }
    const info  = data.local_var.get(name)!
    if (data.variable_treatment === 'read') {
        info.read  = {
            start: {
                line: ast.pos.line,
                column: ast.pos.offset
            },
            end: {
                line: ast.pos.line,
                column: ast.pos.offset + name.length
            }
        };
    }
    else if ( ! info.write) {
        info.write  = {
            start: {
                line: ast.pos.line,
                column: ast.pos.offset
            },
            end: {
                line: ast.pos.line,
                column: ast.pos.offset + name.length
            }
        };
    }
    if ( ! data.preprocess) {
        if (info.read && ! info.write) {
            data.result.push({
                type: 'UndefinedVariable',
                filename: data.filename,
                range: info.read
            });
        }
    }
}

function evalGlobalVariable(ast:Parser.GlobalVariable, data:AnalysisData) {
    const name  = evalName(ast.name);
}

function evalStringNL(ast:Parser.StringNL, data:AnalysisData) {
    for (const elem of ast.v) {
        evalEmpty(elem, data);
    }
    return '';
}

function evalCharInStringSingle(ast:Parser.CharInStringSingle) {
    return evalChar(ast.ch);
}

function evalCharNLInStringSingleSingle(ast:Parser.CharNLInStringSingleSingle, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.CharNLInStringSingleSingle_1: {
            return evalStringNL(ast.nl, data);
            break;
        }
        case Parser.ASTKinds.CharNLInStringSingleSingle_2: {
            return evalCharInStringSingle(ast.ch);
            break;
        }
    }
}

function evalCharNLInStringMultiSingle(ast:Parser.CharNLInStringMultiSingle) {
    switch (ast.kind) {
        case Parser.ASTKinds.CharNLInStringMultiSingle_1: {
            return evalNL(ast.nl);
            break;
        }
        case Parser.ASTKinds.CharNLInStringMultiSingle_2: {
            return evalCharInStringSingle(ast.ch);
            break;
        }
    }
}

function evalExpS1(ast:Parser.ExpS1, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS2(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS1Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS2(ast.head, data);
    }
}

function evalExpS1Sub(ast:Parser.ExpS1Sub, data:AnalysisData) {
    evalExpS2(ast.v, data);
}

function evalExpS2(ast:Parser.ExpS2, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS3(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS2Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS3(ast.head, data);
    }
}

function evalExpS2Sub(ast:Parser.ExpS2Sub, data:AnalysisData) {
    evalExpS3(ast.v, data);
}

function evalExpS3(ast:Parser.ExpS3, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "write";
        evalExpS4(ast.head, data);
        for (let i:number = 0; i < ast.tail.length; i++) {
            // 最後の要素はread
            if (i == ast.tail.length - 1) {
                data.variable_treatment = "read";
            }
            evalExpS3Sub(ast.tail[i], data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS4(ast.head, data);
    }
}

function evalExpS3Sub(ast:Parser.ExpS3Sub, data:AnalysisData) {
    evalExpS4(ast.v, data);
}

function evalExpS4(ast:Parser.ExpS4, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS5(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS4Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS5(ast.head, data);
    }
}

function evalExpS4Sub(ast:Parser.ExpS4Sub, data:AnalysisData) {
    evalExpS5(ast.v, data);
}

function evalExpS5(ast:Parser.ExpS5, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS6(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS5Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS6(ast.head, data);
    }
}

function evalExpS5Sub(ast:Parser.ExpS5Sub, data:AnalysisData) {
    evalExpS6(ast.v, data);
}

function evalExpS6(ast:Parser.ExpS6, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS7(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS6Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS7(ast.head, data);
    }
}

function evalExpS6Sub(ast:Parser.ExpS6Sub, data:AnalysisData) {
    evalExpS7(ast.v, data);
}

function evalExpS7(ast:Parser.ExpS7, data:AnalysisData) {
    if (ast.feedback) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS8(ast.tail, data);
        data.variable_treatment = tmp;
    }
    else {
        evalExpS8(ast.tail, data);
    }
}

function evalExpS8(ast:Parser.ExpS8, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS9(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS8Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS9(ast.head, data);
    }
}

function evalExpS8Sub(ast:Parser.ExpS8Sub, data:AnalysisData) {
    evalExpS9(ast.v, data);
}

function evalExpS9(ast:Parser.ExpS9, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS10(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS9Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS10(ast.head, data);
    }
}

function evalExpS9Sub(ast:Parser.ExpS9Sub, data:AnalysisData) {
    evalExpS10(ast.v, data);
}

function evalExpS10(ast:Parser.ExpS10, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS11(ast.head, data);
        for (const elem of ast.tail) {
            evalExpS10Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExpS11(ast.head, data);
    }
}

function evalExpS10Sub(ast:Parser.ExpS10Sub, data:AnalysisData) {
    evalExpS11(ast.v, data);
}

function evalExpS11(ast:Parser.ExpS11, data:AnalysisData) {
    if (ast.not) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExpS12(ast.tail, data);
        data.variable_treatment = tmp;
    }
    else {
        evalExpS12(ast.tail, data);
    }
}

function evalExpS12(ast:Parser.ExpS12, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.ExpS12_1: {
            evalLocalVariableWithBracketS(ast.local, data);
            break;
        }
        case Parser.ASTKinds.ExpS12_2: {
            evalGlobalVariableWithBracketS(ast.global, data);
            break;
        }
        case Parser.ASTKinds.ExpS12_3: {
            evalNumber(ast.num);
            break;
        }
        case Parser.ASTKinds.ExpS12_4: {
            evalString_Single_Bracket(ast.str, data);
            break;
        }
        case Parser.ASTKinds.ExpS12_5: {
            evalBracketExpS(ast.bracket, data);
            break;
        }
    }
}

function evalExpInString(ast:Parser.ExpInString, data:AnalysisData) {
    evalExpS1(ast.v, data);
}

function evalExpInStringSub(ast:Parser.ExpInStringSub, data:AnalysisData) {
    const tmp = data.variable_treatment
    data.variable_treatment = "read"
    evalExpS1(ast, data);
    data.variable_treatment = tmp
}

function evalCharInString(ast:Parser.CharInString) {
    evalChar(ast.ch);
}

function evalLocalVariableWithBracketS(ast:Parser.LocalVariableWithBracketS, data:AnalysisData) {
    evalLocalVariable(ast.v, data)
    for (const elem of ast.index) {
        evalBracketIndexS(elem, data);
    }
}

function evalGlobalVariableWithBracketS(ast:Parser.GlobalVariableWithBracketS, data:AnalysisData) {
    evalGlobalVariable(ast.v, data)
    for (const elem of ast.append) {
        evalWithBracketS(elem, data);
    }
}

function evalBracketExpS(ast:Parser.BracketExpS, data:AnalysisData) {
    evalExpS1(ast.v, data);
    for (const elem of ast.index) {
        evalBracketIndexS(elem, data);
    }
}

function evalBracketIndexS(ast:Parser.BracketIndexS, data:AnalysisData) {
    evalExpS1(ast.v, data);
}

function evalBracketCallS(ast:Parser.BracketCallS, data:AnalysisData) {
    evalExpS1(ast.v, data);
}

function evalWithBracketS(ast:Parser.WithBracketS, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.WithBracketS_1: {
            evalBracketIndexS(ast.index, data);
            break;
        }
        case Parser.ASTKinds.WithBracketS_2: {
            evalBracketCallS(ast.call, data);
            break;
        }
    }
}

function evalString_Single_Bracket(ast:Parser.String_Single_Bracket, data:AnalysisData) {
    evalString_Single(ast.v, data)
    ast.index.reduce((p, c) => {
        return p + evalBracketIndexS(c, data);
    }, '');
}





function evalExp1(ast:Parser.Exp1, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp2(ast.head, data);
        for (const elem of ast.tail) {
            evalExp1Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp2(ast.head, data);
    }
}

function evalExp1Sub(ast:Parser.Exp1Sub, data:AnalysisData) {
    evalExp2(ast.v, data);
}

function evalExp2(ast:Parser.Exp2, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp3(ast.head, data);
        for (const elem of ast.tail) {
            evalExp2Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp3(ast.head, data);
    }
}

function evalExp2Sub(ast:Parser.Exp2Sub, data:AnalysisData) {
    evalExp3(ast.v, data);
}

function evalExp3(ast:Parser.Exp3, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "write";
        evalExp4(ast.head, data);
        for (let i:number = 0; i < ast.tail.length; i++) {
            // 最後の要素はread
            if (i == ast.tail.length - 1) {
                data.variable_treatment = "read";
            }
            evalExp3Sub(ast.tail[i], data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp4(ast.head, data);
    }
}

function evalExp3Sub(ast:Parser.Exp3Sub, data:AnalysisData) {
    evalExp4(ast.v, data);
}

function evalExp4(ast:Parser.Exp4, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp5(ast.head, data);
        for (const elem of ast.tail) {
            evalExp4Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp5(ast.head, data);
    }
}

function evalExp4Sub(ast:Parser.Exp4Sub, data:AnalysisData) {
    evalExp5(ast.v, data);
}

function evalExp5(ast:Parser.Exp5, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp6(ast.head, data);
        for (const elem of ast.tail) {
            evalExp5Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp6(ast.head, data);
    }
}

function evalExp5Sub(ast:Parser.Exp5Sub, data:AnalysisData) {
    evalExp6(ast.v, data);
}

function evalExp6(ast:Parser.Exp6, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp7(ast.head, data);
        for (const elem of ast.tail) {
            evalExp6Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp7(ast.head, data);
    }
}

function evalExp6Sub(ast:Parser.Exp6Sub, data:AnalysisData) {
    evalExp7(ast.v, data);
}

function evalExp7(ast:Parser.Exp7, data:AnalysisData) {
    if (ast.feedback) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp8(ast.tail, data);
        data.variable_treatment = tmp;
    }
    else {
        evalExp8(ast.tail, data);
    }
}

function evalExp8(ast:Parser.Exp8, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp9(ast.head, data);
        for (const elem of ast.tail) {
            evalExp8Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp9(ast.head, data);
    }
}

function evalExp8Sub(ast:Parser.Exp8Sub, data:AnalysisData) {
    evalExp9(ast.v, data);
}

function evalExp9(ast:Parser.Exp9, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp10(ast.head, data);
        for (const elem of ast.tail) {
            evalExp9Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp10(ast.head, data);
    }
}

function evalExp9Sub(ast:Parser.Exp9Sub, data:AnalysisData) {
    evalExp10(ast.v, data);
}

function evalExp10(ast:Parser.Exp10, data:AnalysisData) {
    if (ast.tail.length > 0) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp11(ast.head, data);
        for (const elem of ast.tail) {
            evalExp10Sub(elem, data);
        }
        data.variable_treatment = tmp;
    }
    else {
        evalExp11(ast.head, data);
    }
}

function evalExp10Sub(ast:Parser.Exp10Sub, data:AnalysisData) {
    evalExp11(ast.v, data);
}

function evalExp11(ast:Parser.Exp11, data:AnalysisData) {
    if (ast.not) {
        const tmp = data.variable_treatment;
        data.variable_treatment = "read";
        evalExp12(ast.tail, data);
        data.variable_treatment = tmp;
    }
    else {
        evalExp12(ast.tail, data);
    }
}

function evalExp12(ast:Parser.Exp12, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.Exp12_1: {
            evalLocalVariableWithBracket(ast.local, data);
            break;
        }
        case Parser.ASTKinds.Exp12_2: {
            evalGlobalVariableWithBracket(ast.global, data);
            break;
        }
        case Parser.ASTKinds.Exp12_3: {
            evalNumber(ast.num);
            break;
        }
        case Parser.ASTKinds.Exp12_4: {
            evalStringV(ast.str, data);
            break;
        }
        case Parser.ASTKinds.Exp12_5: {
            evalBracketExp(ast.bracket, data);
            break;
        }
    }
}

function evalStringSingleSingle(ast:Parser.StringSingleSingle, data:AnalysisData) {
    ast.v.reduce((p, c) => {
        return p + evalCharNLInStringSingleSingle(c, data)
    }, '')
}

function evalStringMultiSingle(ast:Parser.StringMultiSingle) {
    ast.v.reduce((p, c) => {
        return p + evalCharNLInStringMultiSingle(c)
    }, '')
}

function evalString_Single(ast:Parser.String_Single, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.String_Single_1: {
            evalStringSingleSingle(ast.single, data);
            break;
        }
        case Parser.ASTKinds.String_Single_2: {
            evalStringMultiSingle(ast.multi);
            break;
        }
    }
}

function evalStringDoubleSub(ast:Parser.StringDoubleSub, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.StringDoubleSub_1: {
            evalExpInString(ast.exp, data);
            break;
        }
        case Parser.ASTKinds.StringDoubleSub_2: {
            evalStringNL(ast.nl, data);
            break;
        }
        case Parser.ASTKinds.StringDoubleSub_3: {
            evalCharInString(ast.ch);
            break;
        }
    }
}

function evalStringSingleDouble(ast:Parser.StringSingleDouble, data:AnalysisData) {
    ast.v.reduce((p, c) => {
        return p + evalStringDoubleSub(c, data);
    }, '');
}

function evalStringMultiDouble(ast:Parser.StringMultiDouble, data:AnalysisData) {
    ast.v.reduce((p, c) => {
        return p + evalStringDoubleSub(c, data);
    }, '');
}

function evalStringSingle(ast:Parser.StringSingle, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.StringSingle_1: {
            evalStringSingleSingle(ast.single, data);
            break;
        }
        case Parser.ASTKinds.StringSingle_2: {
            evalStringSingleDouble(ast.double, data);
            break;
        }
    }
}

function evalStringMulti(ast:Parser.StringMulti, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.StringMulti_1: {
            evalStringMultiSingle(ast.single);
            break;
        }
        case Parser.ASTKinds.StringMulti_2: {
            evalStringMultiDouble(ast.double, data);
            break;
        }
    }
}

function evalStringV(ast:Parser.StringV, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.StringV_1: {
            evalStringSingle(ast.single, data);
            break;
        }
        case Parser.ASTKinds.StringV_2: {
            evalStringMulti(ast.multi, data);
            break;
        }
    }
}

function evalBracketIndex(ast:Parser.BracketIndex, data:AnalysisData) {
    evalExp1(ast.v, data);
}

function evalBracketCall(ast:Parser.BracketCall, data:AnalysisData) {
    evalExp1(ast.v, data);
}

function evalWithBracket(ast:Parser.WithBracket, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.WithBracket_1: {
            evalBracketIndex(ast.index, data);
            break;
        }
        case Parser.ASTKinds.WithBracket_2: {
            evalBracketCall(ast.call, data);
            break;
        }
    }
}

function evalBracketExp(ast:Parser.BracketExp, data:AnalysisData) {
    evalExp1(ast.v, data);
    for (const elem of ast.index) {
        evalBracketIndex(elem, data);
    }
}

function evalLocalVariableWithBracket(ast:Parser.LocalVariableWithBracket, data:AnalysisData) {
    evalLocalVariable(ast.v, data)
    for (const elem of ast.index) {
        evalBracketIndex(elem, data);
    }
}

function evalGlobalVariableWithBracket(ast:Parser.GlobalVariableWithBracket, data:AnalysisData) {
    evalGlobalVariable(ast.v, data)
    for (const elem of ast.append) {
        evalWithBracket(elem, data);
    }
}

function evalExpression(ast:Parser.Expression, data:AnalysisData) {
    const tmp = data.variable_treatment
    data.variable_treatment = "read"
    evalExp1(ast, data);
    data.variable_treatment = tmp
}





function evalAlternativeSep(ast:Parser.AlternativeSep, data:AnalysisData) {
}





function evalScope1(ast:Parser.Scope1, data:AnalysisData) {
    evalScope2(ast.scope, data);
}

function evalScope2(ast:Parser.Scope2, data:AnalysisData) {
    for (const elem of ast.scope) {
        evalScopeInner(elem, data);
    }
}

function evalScopeInnerSub(ast:Parser.ScopeInnerSub, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.ScopeInnerSub_1: {
            evalScopeParallel(ast.parallel, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_2: {
            evalScope1(ast.scope, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_3: {
            evalScopeIf(ast.scope_if, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_4: {
            evalScopeWhile(ast.scope_while, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_5: {
            evalScopeFor(ast.scope_for, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_6: {
            evalScopeForeach(ast.scope_foreach, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_7: {
            evalScopeCase(ast.scope_case, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_8: {
            evalScopeSwitch(ast.scope_switch, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_9: {
            evalAlternativeSep(ast.alter, data)
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_10: {
            evalExpression(ast.exp, data);
            break;
        }
        case Parser.ASTKinds.ScopeInnerSub_11: {
            evalEmpty(ast.empty, data);
            break;
        }
    }
}

function evalScopeInner(ast:Parser.ScopeInner, data:AnalysisData) {
    evalScopeInnerSub(ast.scope, data);
}

function evalScopeParallel(ast:Parser.ScopeParallel, data:AnalysisData) {
}

function evalScopeIfSubElseIf(ast:Parser.ScopeIfSubElseIf, data:AnalysisData) {
}

function evalScopeIfSubElse(ast:Parser.ScopeIfSubElse, data:AnalysisData) {
}

function evalScopeIf(ast:Parser.ScopeIf, data:AnalysisData) {
}

function evalScopeIfSubIf(ast:Parser.ScopeIfSubIf, data:AnalysisData) {
}

function evalScopeIfIf(ast:Parser.ScopeIfIf, data:AnalysisData) {
}

function evalScopeIfElseIf(ast:Parser.ScopeIfElseIf, data:AnalysisData) {
}

function evalScopeIfElse(ast:Parser.ScopeIfElse, data:AnalysisData) {
}

function evalScopeWhile(ast:Parser.ScopeWhile, data:AnalysisData) {
}

function evalScopeForSub(ast:Parser.ScopeForSub, data:AnalysisData) {
}

function evalScopeFor(ast:Parser.ScopeFor, data:AnalysisData) {
}

function evalScopeForeachSub(ast:Parser.ScopeForeachSub, data:AnalysisData) {
}

function evalScopeForeach(ast:Parser.ScopeForeach, data:AnalysisData) {
}

function evalScopeCase(ast:Parser.ScopeCase, data:AnalysisData) {
}

function evalScopeCaseCase(ast:Parser.ScopeCaseCase, data:AnalysisData) {
}

function evalScopeCaseWhenSub(ast:Parser.ScopeCaseWhenSub, data:AnalysisData) {
}

function evalScopeCaseWhen(ast:Parser.ScopeCaseWhen, data:AnalysisData) {
}

function evalScopeCaseOthers(ast:Parser.ScopeCaseOthers, data:AnalysisData) {
}

function evalScopeSwitch(ast:Parser.ScopeSwitch, data:AnalysisData) {
}

function evalScope(ast:Parser.Scope, data:AnalysisData) {
    evalScope1(ast, data);
}

function evalScopeOuter(ast:Parser.ScopeOuter, data:AnalysisData) {
    evalScope2(ast, data);
}

function evalFunctionName(ast:Parser.FunctionName, data:AnalysisData) {
    const name  = evalName(ast.name);
    const range:Range = {
        start: {
            line: ast.pos.line,
            column: ast.pos.offset
        },
        end: {
            line: ast.pos.line,
            column: ast.pos.offset + name.length
        }
    }
    if (data.preprocess) {
        if ( ! data.global_var.has(name)) {
            data.global_var.set(name, {read:null, write:range});
        }
    }
    else {
        const state = data.global_var.get(name)!
        if ( ! state.read) {
            data.result.push({
                type: 'UnusedFunction',
                filename: data.filename,
                range: range
            });
        }
    }
}

function evalFunctionAlternative(ast:Parser.FunctionAlternative) {
    //evalAlternative(ast.alter);
}

function evalFunction(ast:Parser.Function, data:AnalysisData) {
    evalFunctionName(ast.name, data);
    if (ast.alter) {
        evalFunctionAlternative(ast.alter);
    }
    evalScopeOuter(ast.body, data);
}

function evalGrammarSub(ast:Parser.GrammarSub, data:AnalysisData) {
    switch (ast.kind) {
        case Parser.ASTKinds.GrammarSub_1: {
            evalFunction(ast.func, data);
            break;
        }
        case Parser.ASTKinds.GrammarSub_2: {
            evalEmpty(ast.empty, data);
            break;
        }
    }
}

function evalGrammar(ast:Parser.Grammar, data:AnalysisData) {
    for (const elem of ast.sub) {
        evalGrammarSub(elem, data)
    }
}
