import * as Evaluator from './evaluator';
import * as fs from 'fs'
import { Buffer } from 'node:buffer';

/**
 * file_list: yaya.txtを読み込んで得られたファイルのリスト
 *            辞書を読み込む順番になっているべし。
 *            また、この変数に入っているファイル名は
 *            すべて読み込めることを確認していること。
 * encoding:  辞書の文字コード
 * cache:     vscodeで編集中のデータがあればcacheに突っ込んでこの引数に渡す
 */
export function analyze(file_list:string[], encoding:BufferEncoding, cache:Map<string, string>) {
    for (const file of file_list) {
        if ( ! cache.has(file)) {
            cache.set(file, readFile(file, encoding));
        }
    }
    // ここで(CRLF|CR|LF) -> LFの変換を行う。

    // ここで#defineや#globaldefineの置換処理を行う。
    // parser側で対応しても良いけれど
    // #define,#globaldefineは置換データを得たらLFに置換しておきたい。

    return Evaluator.evaluate(file_list, cache);
}

function decodeAyc(input:Buffer):string {
    // TODO stub
    return '';
}

function readFile(file:string, encoding:BufferEncoding):string {
    const buffer  = fs.readFileSync(file);
    if (file.match(/\.ayc$/)) {
        return decodeAyc(buffer);
    }
    return buffer.toString(encoding);
}
