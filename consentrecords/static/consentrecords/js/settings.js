var Settings = (function () {
	Settings.prototype = new SitePanel();
	Settings.prototype.firstNameLabel = "First Name";
	Settings.prototype.lastNameLabel = "Last Name";
	Settings.prototype.publicAccessLabel = "Public Access to Me";
	Settings.prototype.accessRequestLabel = "Access Requests";
	Settings.prototype.screenNameLabel = "Screen Name";

	function Settings(user, previousPanel) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Settings", "edit settings", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle('Settings');
		
		var panel2Div = this.appendScrollArea();
		var birthdayCell = user.getCell("Birthday");
		var oldAppendUpdateBirthdayCommands = birthdayCell.data[0].appendUpdateCommands;
		
		/* Change the birthdayCell's data command to validate the birthday and update the
			corresponding birthday in the More Experiences object.
		 */
		birthdayCell.data[0].appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
		{
			if (!newValue)
				throw ("Your birthday is required.");
			var birthMonth = newValue.substr(0, 7);
			if (birthMonth.length < 7)
				throw ("Your birthday must include a year and a month.");
			oldAppendUpdateBirthdayCommands.call(birthdayCell.data[0], i, newValue, initialData, sourceObjects);
			user.getValue("More Experiences").getValue("Birthday").appendUpdateCommands(0, birthMonth, initialData, sourceObjects);
		}
			
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
					birthdayCell.data[0].appendUpdateCommands = oldAppendUpdateBirthdayCommands;
				})
 			.append("span").text("Done");
		
		user.getCell("_first name").field.label = this.firstNameLabel;
		user.getCell("_last name").field.label = this.lastNameLabel;
		user.getCell("_public access").field.label = this.publicAccessLabel;
		user.getValue("More Experiences").getCell("_name").field.label = this.screenNameLabel;
		
		var cells = [user.getCell("_first name"),
					 user.getCell("_last name"),
					 birthdayCell,
					 user.getCell("_public access"),
					 user.getValue("More Experiences").getCell("_name")];
					 
		this.showEditCells(cells);
		
		if (user.privilege === "_administer")
		{
			function checkSharingBadge()
			{
				var cell = user.getCell("_access request");
				cell.field.label = _this.accessRequestLabel;
				var badgeCount = (cell && cell.data.length > 0) ? cell.data.length : "";

				sharingButton.selectAll("span.badge").text(badgeCount);
			}
			
			var sharingDiv = this.appendActionButton('Sharing', function() {
					if (prepareClick('click', 'Sharing'))
					{
						showClickFeedback(this);
						var panel = new SharingPanel(user, _this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				})
				.classed('first', true);
			var sharingButton = sharingDiv.select('ol>li>div');
			sharingButton.append('span')
				.classed('badge', true);
			checkSharingBadge();
			
			$(user.getCell("_access request")).on("valueDeleted.cr valueAdded.cr", checkSharingBadge);
			$(sharingButton.node()).on("remove", function()
			{
				$(user.getCell("_access request")).off("valueDeleted.cr", checkSharingBadge)
					.off("valueAdded.cr", checkSharingBadge);
			});
				
			this.appendActionButton('Following', function() {
					if (prepareClick('click', 'Following'))
					{
						showClickFeedback(this);
						var panel = new FollowingPanel(user, _this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				});
		}
				
		if (user == cr.signedinUser)
		{
			this.appendActionButton('Change Email', function() {
					if (prepareClick('click', 'Change Email'))
					{
						showClickFeedback(this);
						var panel = new UpdateUsernamePanel(user, _this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				});
		
			this.appendActionButton('Change Password', function() {
					if (prepareClick('click', 'Change Password'))
					{
						showClickFeedback(this);
						var panel = new UpdatePasswordPanel(_this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				});

			this.appendActionButton('Sign Out', function() {
					if (prepareClick('click', 'Sign Out'))
					{
						showClickFeedback(this);
						sign_out(syncFailFunction);
					}
				})
				.classed('first', true);
		}
	}
	
	return Settings;
})();
