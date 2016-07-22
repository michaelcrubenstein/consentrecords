var Settings = (function () {
	Settings.prototype = new SitePanel();
	Settings.prototype.firstNameLabel = "First Name";
	Settings.prototype.lastNameLabel = "Last Name";
	Settings.prototype.userPublicAccessLabel = "Profile Visibility";
	Settings.prototype.accessRequestLabel = "Access Requests";
	Settings.prototype.screenNameLabel = "Screen Name";
	Settings.prototype.pathPublicAccessLabel = "Path Visiblity";
	Settings.prototype.pathSameAccessLabel = "Same As Profile";
	Settings.prototype.pathAlwaysPublicAccessLabel = "Public";
	Settings.prototype.profileHiddenLabel = "Hidden";
	Settings.prototype.emailVisibleLabel = "Request by Email";
	Settings.prototype.allVisibleLabel = "Public";

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
		
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
					birthdayCell.data[0].appendUpdateCommands = oldAppendUpdateBirthdayCommands;
				})
 			.append("span").text("Done");

		var userPublicAccessCell = user.getCell("_public access");
		var pathPublicAccessCell = path.getCell("_public access");
		
		user.getCell("_first name").field.label = this.firstNameLabel;
		user.getCell("_last name").field.label = this.lastNameLabel;
		path.getCell("_name").field.label = this.screenNameLabel;
		userPublicAccessCell.field.label = this.userPublicAccessLabel;
		userPublicAccessCell.data[0].getDescription = function() 
			{
				if (this.description == "_read" ||
					this.description == _this.allVisibleLabel)
					return _this.allVisibleLabel;
				else if (this.description == "_find" ||
					this.description == _this.emailVisibleLabel)
					return _this.emailVisibleLabel;
				else
					return _this.profileHiddenLabel;
			};
		
		pathPublicAccessCell.field.label = this.pathPublicAccessLabel;
		pathPublicAccessCell.data[0].getDescription = function() 
			{
				if (this.description == "_read" ||
					this.description == _this.pathAlwaysPublicAccessLabel)
					return _this.pathAlwaysPublicAccessLabel;
				else
					return _this.pathSameAccessLabel;
				};
		
		var cells = [user.getCell("_first name"),
					 user.getCell("_last name"),
					 path.getCell("_name"),
					 birthdayCell
					 ];
					 
		this.showEditCells(cells);
		
		var addUniqueCellSection = function(cell, label, clickFunction)
		{
			var sectionPanel = panel2Div.append('section')
				.classed('cell edit unique btn row-button', true)
				.datum(cell)
				.on("click", clickFunction);
				
			sectionPanel.append('label')
				.text(label);
			
			var itemsDiv = sectionPanel.append("ol")
				.classed("right-label", true);

			var divs = appendItems(itemsDiv, cell.data);
	
			var buttons = appendRowButtons(divs);

			appendRightChevrons(buttons);	
		
			appendButtonDescriptions(buttons)
				.each(_pushTextChanged);
		}
		
		if (user.privilege === "_administer")
		{
			addUniqueCellSection(userPublicAccessCell, this.userPublicAccessLabel,
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.userPublicAccessLabel))
					{
						try
						{
							var panel = new PickUserAccessPanel(cell.data[0], _this.node());
							showPanelLeft(panel.node(), unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
				});
			
			addUniqueCellSection(pathPublicAccessCell, this.pathPublicAccessLabel,
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.pathPublicAccessLabel))
					{
						try
						{
							var panel = new PickPathAccessPanel(cell, path, user, _this.node());
							showPanelLeft(panel.node(), unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
				});
		
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

var PickFromListPanel = (function () {
	PickFromListPanel.prototype = new SitePanel();

	function PickFromListPanel(previousPanel, title, panelClass) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, title, "list " + panelClass, revealPanelLeft);

		if (previousPanel)
		{
			var navContainer = this.appendNavContainer();

			var backButton = navContainer.appendLeftButton()
				.on("click", function()
				{
					if (prepareClick('click', 'pick path access panel: Cancel'))
					{
						_this.hidePanelRight(unblockClick);
					}
					d3.event.preventDefault();
				});
			backButton.append("span").text("Cancel");
		
			navContainer.appendTitle(this.title);

			var panel2Div = this.appendScrollArea();
			var itemsDiv = panel2Div.append("section")
				.classed("multiple", true)
				.append("ol");
		}
	}
	
	return PickFromListPanel;

})();

var PickUserAccessPanel = (function () {
	PickUserAccessPanel.prototype = new PickFromListPanel();
	PickUserAccessPanel.prototype.title = Settings.prototype.userPublicAccessLabel;
	PickUserAccessPanel.prototype.buttonData = [{description: Settings.prototype.profileHiddenLabel,
						   instancePath: null
						  },
						  {description: Settings.prototype.emailVisibleLabel,
						   instancePath: "_term[_name=_privilege]>enumerator[_name=_find]"
						  },
						  {description: Settings.prototype.allVisibleLabel,
						   instancePath: "_term[_name=_privilege]>enumerator[_name=_read]"
						  }
						 ];
	
	function PickUserAccessPanel(oldValue, previousPanel) {
		var _this = this;
		PickFromListPanel.call(this, previousPanel, this.title, "list");

		if (previousPanel)
		{
			var itemsDiv = d3.select(this.node()).selectAll('section>ol');
		
			var buttons = itemsDiv.selectAll('li')
				.data(this.buttonData)
				.enter()
				.append('li');
			
			buttons.append("div").classed("btn row-button multi-row-content expanding-div", true)
				.append("div")
						.classed("description-text", true)
						.text(function(d) { return d.description; });
					
			buttons.selectAll('div.btn').filter(function(d, i)
				{
					return d.description === oldValue.getDescription();
				})
				.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", true);
					
			buttons.selectAll('div.btn')
				.on('click', function(d, i)
					{
						if (d.description === oldValue.getDescription())
							return;
						
						if (prepareClick('click', d.description))
						{
							try
							{
								var sourceObjects = [oldValue];
								var initialData;
								if (!d.instancePath)
								{
									initialData = [{ id: oldValue.id }];
								}
								else
								{
									initialData = [
											{
												containerUUID: oldValue.cell.parent.getValueID(),
												fieldID: oldValue.cell.field.nameID,
												instance: d.instancePath,
												description: d.description
											}];
								}
								cr.updateValues(initialData, sourceObjects, function()
									{
										hidePanelRight(_this.node());
									},
									syncFailFunction);
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					});
		}
	}
	
	return PickUserAccessPanel;
})();

var PickPathAccessPanel = (function () {
	PickPathAccessPanel.prototype = new PickFromListPanel();
	PickPathAccessPanel.prototype.title = Settings.prototype.pathPublicAccessLabel;

	function PickPathAccessPanel(cell, path, user, previousPanel) {
		var _this = this;
		PickFromListPanel.call(this, previousPanel, this.title, "path-access");

		if (cell)
		{
			var itemsDiv = d3.select(this.node()).selectAll('section>ol');
		
			var noneButton = itemsDiv.append('li');
		
			if (cell.data.length == 0 ||
				!cell.data[0].getValueID())
			{
				noneButton.on('click', function()
					{
						if (prepareClick('click', 'pick path access panel: Cancel Read Button'))
						{
							_this.hidePanelRight(unblockClick);
						}
					});
			}
			else
			{
				noneButton.on('click', function()
					{
						if (prepareClick('click', Settings.prototype.pathSameAccessLabel))
						{
							try
							{
								var sourceObjects = [path.getValue("_special access"), 
													 path.getValue("_public access"),
													 path.getValue("_primary administrator"),
													];
								var initialData = sourceObjects.map(function(d) { return { id: d.id };});
								cr.updateValues(initialData, sourceObjects, function()
									{
										hidePanelRight(_this.node(), unblockClick);
									},
									syncFailFunction);
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					});
			}
			noneButton.append("div").classed("btn row-button multi-row-content expanding-div", true)
				.append("div")
						.classed("description-text", true)
						.text(Settings.prototype.pathSameAccessLabel);
			var readButton = itemsDiv.append('li');
		
			if (cell.data.length == 0 ||
				!cell.data[0].getValueID())
			{
				readButton.on('click', function()
					{
						if (prepareClick('click', Settings.prototype.pathAlwaysPublicAccessLabel))
						{
							try
							{
								var sourceObjects = [path.getValue("_public access"),
													 path.getValue("_primary administrator"),
													 path.getValue("_special access"), 
													];
								var containerID = path.getValueID();
								var primaryAdministrator = user.getValue("_primary administrator");
								if (!primaryAdministrator.getValueID())
									primaryAdministrator = user;
								var initialData = [
									{
										containerUUID: containerID,
										fieldID: path.getCell("_public access").field.nameID,
										instance: "_term[_name=_privilege]>enumerator[_name=_read]",
										description: Settings.prototype.pathAlwaysPublicAccessLabel
									},
									{
										containerUUID: containerID,
										fieldID: path.getCell("_primary administrator").field.nameID,
										instanceID: primaryAdministrator.getValueID(),
										description: primaryAdministrator.getDescription()
									},
									{
										containerUUID: containerID,
										fieldID: path.getCell("_special access").field.nameID,
										instance: '_term[_name="_special access"]>enumerator[_name=_custom]',
										description: '_custom'
									},
								];
							
								cr.updateValues(initialData, sourceObjects, function()
									{
										hidePanelRight(_this.node(), unblockClick);
									},
									syncFailFunction);
							}
							catch(err)
							{
								syncFailFunction(err);
							}
						}
					});
			}
			else
			{
				readButton.on('click', function()
					{
						if (prepareClick('click', 'pick path access panel: Cancel Read Button'))
						{
							_this.hidePanelRight(unblockClick);
						}
					});
			}
			readButton.append("div").classed("btn row-button multi-row-content expanding-div", true)
				.append("div")
						.classed("description-text", true)
						.text(Settings.prototype.pathAlwaysPublicAccessLabel);

			if (cell.data.length == 0 ||
				!cell.data[0].getValueID())
				noneButton.select('div:first-child').insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", true);
			else
				readButton.select('div:first-child').insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", true);			
		}
	}
	
	return PickPathAccessPanel;
})();