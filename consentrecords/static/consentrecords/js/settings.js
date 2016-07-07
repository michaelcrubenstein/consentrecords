var Settings = (function () {
	Settings.prototype = new SitePanel();
	Settings.prototype.firstNameLabel = "First Name";
	Settings.prototype.lastNameLabel = "Last Name";
	Settings.prototype.publicAccessLabel = "Public Access to My Profile";
	Settings.prototype.accessRequestLabel = "Access Requests";
	Settings.prototype.screenNameLabel = "Screen Name";
	Settings.prototype.pathPublicAccessLabel = "Public Access to My Path";

	function Settings(user, previousPanel) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Settings", "edit settings", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle('Settings');
		
		var panel2Div = this.appendScrollArea();
		
		var path = user.getValue("More Experiences");
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
			path.getValue("Birthday").appendUpdateCommands(0, birthMonth, initialData, sourceObjects);
		}
		
		pathPublicAccessCell = path.getCell("_public access");
		var oldAppendUpdatePathPublicAccessCommands = pathPublicAccessCell.data[0].appendUpdateCommands;
		var oldAddPathPublicAccessValue = pathPublicAccessCell.addObjectValue;
		var oldDeletePathPublicAccessValue = pathPublicAccessCell.data[0].deleteValue;
		
		/* Change the _public access appendUpdateCommands function so that
			1. when the _public access is set to _read, the _special access is set to _custom
			2. when the _public access is cleared, the _special access is cleared
		 */
		
		pathPublicAccessCell.addObjectValue = function(initialData, done, fail)
		{
			/* Add the public access value and then the special access value so that 
			    the system is never in an invalid state. 
			 */
			oldAddPathPublicAccessValue.call(pathPublicAccessCell, initialData, 
				function(newPublicAccessData)
				{
					var pathSpecialAccessCell = path.getCell("_special access");
					crp.getData({path: '_term[_name="_special access"]>enumerator',
								 done: function(newInstances)
								 	{
										var newSpecialAccessData = newInstances[0];
										pathSpecialAccessCell.addObjectValue(newSpecialAccessData, 
											function()
											{
												done(newPublicAccessData);
											},
											fail);
								 	},
								 fail: fail});
				}, fail);
		}
		
		pathPublicAccessCell.data[0].deleteValue = function(done, fail)
		{
			/* Remove the special access value and then the public access value so that 
			    the system is never in an invalid state. 
			 */
			var pathSpecialAccessCell = path.getCell("_special access");
			if (pathSpecialAccessCell.data.length > 0 && !pathSpecialAccessCell.data[0].isEmpty())
			{
				pathSpecialAccessCell.data[0].deleteValue(function()
					{
						oldDeletePathPublicAccessValue.call(pathPublicAccessCell.data[0], done, fail);
					},
					fail);
			}
			else
				oldDeletePathPublicAccessValue.call(pathPublicAccessCell.data[0], done, fail);
		}
			
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
					birthdayCell.data[0].appendUpdateCommands = oldAppendUpdateBirthdayCommands;
					pathPublicAccessCell.addObjectValue = oldAddPathPublicAccessValue;
					pathPublicAccessCell.data[0].deleteValue = oldDeletePathPublicAccessValue;
				})
 			.append("span").text("Done");
		
		user.getCell("_first name").field.label = this.firstNameLabel;
		user.getCell("_last name").field.label = this.lastNameLabel;
		user.getCell("_public access").field.label = this.publicAccessLabel;
		path.getCell("_name").field.label = this.screenNameLabel;
		pathPublicAccessCell.field.label = this.pathPublicAccessLabel;
		
		var cells = [user.getCell("_first name"),
					 user.getCell("_last name"),
					 birthdayCell,
					 user.getCell("_public access"),
					 path.getCell("_name"),
					 pathPublicAccessCell];
					 
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
