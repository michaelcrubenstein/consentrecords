var Settings = (function () {
	Settings.prototype = new SitePanel();

	function Settings(user, previousPanel) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Settings", "edit settings-panel");

		var navContainer = this.appendNavContainer();

		navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					showClickFeedback(this);
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			})
			.append("span").text("Cancel");

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle('Settings');
		
		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
			
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
				})
 			.append("span").text("Done");
			
		var cells = [user.getCell("_first name"),
					 user.getCell("_last name"),
					 user.getCell("Birthday"),
					 user.getCell("_public access")];
					 
		this.showEditCells(cells);
		
		if (user == cr.signedinUser)
		{
			this.appendActionButton('Change Email', function() {
					if (prepareClick('click', 'Change Email'))
					{
						var panel = new UpdateUsernamePanel(user, _this.node());
					}
				});
		
			this.appendActionButton('Change Password', function() {
					if (prepareClick('click', 'Change Password'))
					{
						var panel = new UpdatePasswordPanel(_this.node());
						showPanelLeft(panel.node(), unblockClick);
					}
				});
		}
		
		showPanelLeft(this.node(), unblockClick);
	}
	
	return Settings;
})();
