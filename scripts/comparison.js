let mammoth = require('mammoth')

//HTML ripped from files as well as error/warning messages
let rippedHtml

module.exports ={

	/*Reads the contents of a docx and converts it to html
	file: array of 3 docx files
	field: array of 3 <p> tags. This is where the html will go
	Possible for some or all elements to be null
	*/
	render: async function (files, field){

		//At LEAST the first 2 docs have to be filled
		let numOfFiles
		if(files.length > 2){
			numOfFiles = files.length-1
			rippedHtml = new Array(files.length-1)
			rippedHtml.fill(null)
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
				field[i].innerHTML = rippedHtml[i]
			})
			.done()
		}
		return true
	}
}

