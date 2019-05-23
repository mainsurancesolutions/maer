const fs = require('fs')

module.exports ={
	save: function(path, docPaths, docNicknames){
		/*Create a string to save the file as. The string will be of the format
		path to file 1
		nickname for file 1
		path to file 2
		nickname for file 2
		If file 3 exists, same as above. Otherwise "null"*/
		let data = ""
		for(let i = 0; i < 3; i++){
			if(docPaths[i] !== null){
				data += (docPaths[i].path + "\r\n")
				data += (docNicknames[i] + "\r\n")
			}
			else{
				data += "null"
			}
		}

		//Now that we have the path, filename, and data, we can write it to a file
		fs.writeFileSync(path, data)
	},

	load: async function(saveFile){
		//Create a filestream to read lines 1 by 1
		let reader = require('readline').createInterface({
			input: require('fs').createReadStream(saveFile)
		})
		
		//Put the contents of the docs in one array and the
		//given nicknames in another, then return both
		let lineCounter = 0
		//The list of paths, after being formatted
		let docsToLoad = []
		//Nicknames ripped from the saveFile
		let docNames = []
		reader.on('line', function(line){
			if(line === "null"){
				docsToLoad.push(null)
			}
			else if(lineCounter%2 === 0){
				/*
				Push the path to an array where we will send it
				to be rendered. The rendered requires the 'path'
				parameter in the file
				*/
				docsToLoad.push({path: line})
			}
			else
				docNames.push(line)
			lineCounter++
		})
		return [docsToLoad, docNames]
	}
}