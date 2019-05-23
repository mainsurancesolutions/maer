let mammoth = require('mammoth')

//HTML ripped from files as well as error/warning messages
let rippedHtml = [null, null, null]
let messages = [null, null, null]

module.exports ={

	/*Reads the contents of a docx and converts it to html
	file: array of 3 docx files
	field: array of 3 <p> tags. This is where the html will go
	Possible for some or all elements to be null
	*/
	render: async function (files, field){

		//At LEAST the first 2 docs have to be filled
		let numOfFiles
		if(files[0] !== null && files[1] !== null){
			numOfFiles = 2
			if(files[2] !== null && files[2] !== undefined)
				numOfFiles++
		}
		else{
			alert("You must upload at least 2 files to be compared")
			return false
		}

		for(let i=0; i<numOfFiles; i++){
			field[i].innerHTML = "Processing..."
			await mammoth.convertToHtml({path: files[i].path})
			.then(function(result){
				rippedHtml[i] = result.value //Html generated from docx
				messages[i] = result.messages //Warnings or errors generated
				field[i].innerHTML = rippedHtml[i]
			})
			.done()
		}
		return true
	}
}

