var Settings = (function () {
	Settings.prototype = new SitePanel();

	function Settings(user, previousPanel) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Settings", "edit settings", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle('Settings');
		
		var panel2Div = this.appendScrollArea();
			
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
		
		if (user.privilege === "_administer")
		{
			function checkSharingBadge()
			{
				var cell = user.getCell("_access request");
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
