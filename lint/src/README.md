# 用意するもの
tspeg
```
npm install -g tspeg
```
もしかしたらpackage.jsonのdevdependenciesに書き込めば
なんかいい感じにやってくれるかもしれないけれどよく分かってない。

でコマンドを実行。
```
tspeg --include-grammar-comment=false grammar.peg parser.ts
```

# Planning  
Store the syntax tree parsed from the peg file in a suitable data format in the lint_data class (feel free to modify the `lint_data.ts` file)  
Parse the lint_data class rather than parsing the syntax tree directly  

The benefits are as follows:  
- When any dic file is updated, we simply update the lint_data corresponding to that file and then perform a syntax analysis on the lint_data class  
- When the order of the dic files is changed, we only need to reorder the dic files instead of reloading all the dic files.  
- The lint_data class is used to store data for other possible future operations, such as completing hints or quick fixes.  

If you have other ideas for improvement, consider writing them here  
