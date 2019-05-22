const fs = require('fs')

module.exports ={
	save: function(path, docPaths){
		/*Create a string to save the file as. The string will be of the format
		path to file 1
		nickname for file 1
		
		path to file 2
		nickname for file 2

		If file 3 exists, same as above. Otherwise "null"*/
		let data = "blah"
		for(let i = 0; i < 3; i++){
			if(docPaths[i] !== null){
				data.concat(docPaths[i].path + "\n")
				data.concat("Nickname here" + "\n\n")
			}
			else{
				data.concat("null")
			}
		}

		//Now that we have the path, filename, and data, we can write it to a file
		fs.writeFileSync(path, data)
	}
}