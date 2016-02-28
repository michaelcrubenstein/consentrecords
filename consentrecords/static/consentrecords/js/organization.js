/*
	organization.js
	
	Utility routines for managing organizations and their contents
 */

/* Append the specified address to the specified div, which is a d3.js object */
function appendAddress(address, div)
{
	crp.pushCheckCells(address, function()
	{
		var streetCell = address.getCell("Street");
		var city = address.getDatum("City");
		var stateCell = address.getCell("State");
		var zip = address.getDatum("Zip Code");
		if (streetCell)
			$(streetCell.data).each(function() {
				if (this.text && this.text.length > 0)
				{
					div.append('div')
						.classed("address-line", true)
						.text(this.text);
				}
			});
		line = "";
		if (city && city.length)
			line += city;
		if (stateCell && stateCell.data.length)
			line += ", " + stateCell.data[0].getDescription();
		if (zip && zip.length)
			line += "  " + zip;
		if (line.trim())
			div.append('div')
				.classed('address-line', true)
				.text(line.trim());
	},
	function() {
	});
}
