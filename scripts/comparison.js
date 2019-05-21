let mammoth = require('mammoth')

//HTML ripped from files as well as error/warning messages
let rippedHtml = [null, null, null]
let messages = [null, null, null]

module.exports ={
	/*Renders the ripped html from the files to 
	the provided <p> fields
	*/
	render: async function(files, field){
		readFiles(files)
		for(let i = 0; i < 3; i++){
			field[i].innerHTML = rippedHtml[i]		
		}
	}
}

/*Reads the contents of a docx and converts it to html
file: array of 3 docx files
Possible for some or all elements to be null
*/
async function readFiles (files){
	
	for(let i=0; i<3; i++){
		mammoth.convertToHtml(files[i])
		.then(function(result){
			rippedHtml[i] = result.value //Html generated from docx
			messages[i] = result.messages //Warnings or errors generated
		})
		.done()
	}
}