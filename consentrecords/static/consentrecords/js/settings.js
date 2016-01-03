var Settings = (function () {
	
	function Settings(previousPanel) {
	
		var sitePanel = new SitePanel(previousPanel, null, "Settings", "edit settings-panel");

		var navContainer = sitePanel.appendNavContainer();

		navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					hidePanelRight($(this).parents(".site-panel")[0]);
				}
				d3.event.preventDefault();
			})
			.append("span").text("Cancel");

		navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick())
				{
					showClickFeedback(this);
					var newEmail = emailInput.property('value');
					var newBirthday = birthdayInput.value();
					function validateEmail(email) 
					{
						var re = /\S+@\S+\.\S\S+/;
						return re.test(email);
					}
		
					if (newEmail.length == 0)
					{
						syncFailFunction('The email address is required');
						emailInput.node().focus();
					}
					else if (!validateEmail(newEmail))
					{
						syncFailFunction('The email address is not valid');
						emailInput.node().focus();
					}
					else
					{
						hidePanelRight($(this).parents(".site-panel")[0]);
					}
				}
				d3.event.preventDefault();
			})
			.append("span").text("Done");

		navContainer.appendTitle('Settings');
		
		var panel2Div = sitePanel.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
			
		panel2Div.appendAlertContainer();
	
		var firstNameInput = panel2Div.append('section').classed('cell edit unique string', true)
			.datum(userInstance.getCell("_first name"))
			.append('ol').classed('items-div', true)
			.append('li').classed('string-input-container', true)
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'First Name')
			.property('value', function(cell) {
				if (cell.data.length > 0) 
					return cell.data[0].value;
				else
					return null;
			});
			
		var lastNameInput = panel2Div.append('section').classed('cell edit unique string', true)
			.datum(userInstance.getCell("_last name"))
			.append('ol').classed('items-div', true)
			.append('li').classed('string-input-container', true)
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', 'Last Name')
			.property('value', function(cell) {
				if (cell.data.length > 0) 
					return cell.data[0].value;
				else
					return null;
			});
			
		var emailInput = panel2Div.append('section').classed('cell edit unique string', true)
			.datum(userInstance.getCell("_email"))
			.append('ol').classed('items-div', true)
			.append('li').classed('string-input-container', true)
			.append('input')
			.attr('type', 'email')
			.attr('placeholder', 'email address')
			.property('value', function(cell) {return cell.data[0].value;});
			
		var div = panel2Div.append('section').classed('cell edit unique string', true);
		div.append('label')
			.text('Birthday');
		var c = div.append('ol').classed('items-div', true)
			.append('li').classed('string-input-container', true)
		
		var birthdayInput = new DateInput(c.node());
		var newValue = userInstance.getCell("Birthday").data[0].value;
		if (newValue && newValue.length > 0)
			birthdayInput.value(newValue);
			
		showPanelLeft(sitePanel.node());
	}
	
	return Settings;
})();
