const fs = require('fs')

module.exports ={
	save: function(path, docPaths){
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
				data += ("Nickname here" + "\r\n\r\n")
			}
			else{
				data += "null"
			}
		}

		//Now that we have the path, filename, and data, we can write it to a file
		fs.writeFileSync(path, data)
	}
}