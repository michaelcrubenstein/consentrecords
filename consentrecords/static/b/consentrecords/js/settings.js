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
	Settings.prototype.emailVisibleLabel = "By Request";
	Settings.prototype.pathVisibleLabel = "Public Path Only";
	Settings.prototype.allVisibleLabel = "Public Profile and Path";
	Settings.prototype.hiddenDocumentation = "No one will be able to locate or identify you.";
	Settings.prototype.byRequestVisibleDocumentation = "Others can request access to your profile if they know your email address.";
	Settings.prototype.pathVisibleDocumentation = "Your path may be found by others, identified only by your screen name. Others can request access to your profile if they know your email address.";
	Settings.prototype.allVisibleDocumentation = "Others can look at your profile and path (except for information you hide from view).";

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
		var pathSpecialAccessCell = path.getCell("_special access");
		
		user.getCell("_first name").field.label = this.firstNameLabel;
		user.getCell("_last name").field.label = this.lastNameLabel;
		path.getCell("_name").field.label = this.screenNameLabel;
		userPublicAccessCell.field.label = this.userPublicAccessLabel;
		userPublicAccessCell.data[0].getDescription = function() 
			{
				if (this.description == "_read" ||
					this.description == _this.allVisibleLabel)
					return _this.allVisibleLabel;
				else if (pathPublicAccessCell.data[0].description == "_read" ||
				         this.description == _this.pathVisibleLabel)
				    return _this.pathVisibleLabel;
				else if (this.description == "_find" ||
						 this.description == _this.emailVisibleLabel)
					return _this.emailVisibleLabel;
				else
					return _this.profileHiddenLabel;
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
		
			return appendButtonDescriptions(buttons)
				.each(_pushTextChanged);
		}
		
		if (user.privilege === "_administer")
		{
			var userPublicAccessValue = userPublicAccessCell.data[0];
			var pathPublicAccessValue = pathPublicAccessCell.data[0];
			var pathSpecialAccessValue = pathSpecialAccessCell.data[0];
			
			var divs = addUniqueCellSection(userPublicAccessCell, this.userPublicAccessLabel,
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.userPublicAccessLabel))
					{
						try
						{
							var panel = new PickUserAccessPanel(userPublicAccessValue, pathPublicAccessValue, pathSpecialAccessValue, _this.node());
							showPanelLeft(panel.node(), unblockClick);
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}
				});
			
			/* Change the contents of the div when the pathPublicAccessValue changes as well. */	
			divs.each(function()
				{
					var d = pathPublicAccessValue;
					var f = function(eventObject) {
						d3.select(eventObject.data).text(userPublicAccessValue.getDescription());
					}
	
					$(d).on("dataChanged.cr", null, this, f);
					$(this).on("remove", null, d, function(eventObjects) {
						$(this.eventObject).off("dataChanged.cr", null, f);
					});
	
					$(d).on("valueDeleted.cr", null, this, f);
					$(this).on("remove", null, d, function(eventObjects) {
						$(this.eventObject).off("valueDeleted.cr", null, f);
					});
				});
			
			var docSection = panel2Div.append('section')
				.classed('cell documentation', true);
			
			var docDiv = docSection.append('div');
			
			var updateVisibilityDocumentation = function()
			{
				var description = userPublicAccessValue.getDescription();
				var documentation;
			
				if (description === _this.profileHiddenLabel)
					documentation = _this.hiddenDocumentation;
				else if (description === _this.emailVisibleLabel)
					documentation = _this.byRequestVisibleDocumentation;
				else if (description === _this.pathVisibleLabel)
					documentation = _this.pathVisibleDocumentation;
				else if (description === _this.allVisibleLabel)
					documentation = _this.allVisibleDocumentation;
				docDiv.text(documentation);
			}
			
			$(userPublicAccessValue).on("valueDeleted.cr dataChanged.cr", null, docDiv, updateVisibilityDocumentation);
			$(pathPublicAccessValue).on("valueDeleted.cr dataChanged.cr", null, docDiv, updateVisibilityDocumentation);
			$(docDiv).on("remove", null, null, function(eventObjects) {
				$(userPublicAccessValue).off("valueDeleted.cr dataChanged.cr", null, updateVisibilityDocumentation);
				$(pathPublicAccessValue).off("valueDeleted.cr dataChanged.cr", null, updateVisibilityDocumentation);
			});
			updateVisibilityDocumentation();
	
			function checkSharingBadge()
			{
				var cell = user.getCell("_access request");
				cell.field.label = _this.accessRequestLabel;
				var badgeCount = (cell && cell.data.length > 0) ? cell.data.length : "";

				sharingButton.selectAll("span.badge").text(badgeCount);
			}
			
			var urlSection = panel2Div.append('section')
				.classed('cell edit unique', true)
				.datum(user.getCell("_email"));
				
			urlSection.append('label')
				.text("Your Path");
					
			var urlList = urlSection.append("ol")
				.classed('right-label', true);
						
			var urlItem = urlList.append('li')
				.classed('site-active-text', true)
				.text("{0}/for/{1}"
					.format(window.location.origin, user.getDatum("_email")))
				.on('click', function()
					{
						if (prepareClick('click', 'share'))
						{
							try
							{
								new ShareOptions(_this.node(), user);
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					});
					
			function updateURL()
			{
				urlItem.text("{0}/for/{1}"
					.format(window.location.origin, user.getDatum("_email")));
			}
			$(user.getCell("_email")).on('dataChanged.cr', null, urlItem.node(), updateURL);
			$(urlItem.node()).on('remove', null, user.getCell("_email"), function(eventObject)
				{
					$(eventObject.data).off('dataChanged.cr', urlItem.node(), updateURL);
				});
	
			var sharingDiv = this.appendActionButton('Sharing', function() {
					if (prepareClick('click', 'Sharing'))
					{
						showClickFeedback(this);
						var panel = new SharingPanel(user, _this.node());
						showPanelUp(panel.node())
								.always(unblockClick);
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
						showPanelUp(panel.node())
							.always(unblockClick);
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
						showPanelUp(panel.node())
							.always(unblockClick);
					}
				});
		
			this.appendActionButton('Change Password', function() {
					if (prepareClick('click', 'Change Password'))
					{
						showClickFeedback(this);
						var panel = new UpdatePasswordPanel(_this.node());
						showPanelUp(panel.node())
							.always(unblockClick);
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

/* When the user picks an access that includes a special access for the path, 
	the _special access value is set. Otherwise, it is cleared. Currently, there is 
	no check for whether there are access records on the path because there is no such
	functionality.
 */ 
var PickUserAccessPanel = (function () {
	PickUserAccessPanel.prototype = new PickFromListPanel();
	PickUserAccessPanel.prototype.title = Settings.prototype.userPublicAccessLabel;
	PickUserAccessPanel.prototype.buttonData = [{description: Settings.prototype.profileHiddenLabel,
						   instancePath: null
						  },
						  {description: Settings.prototype.emailVisibleLabel,
						   instancePath: "_term[_name=_privilege]>enumerator[_name=_find]"
						  },
						  {description: Settings.prototype.pathVisibleLabel,
						   instancePath: "_term[_name=_privilege]>enumerator[_name=_find]",
						   pathPrivilegePath: "_term[_name=_privilege]>enumerator[_name=_read]",
						   pathPrivilegeDescription: "_read",
						   pathSpecialAccessPath: '_term[_name="_special access"]>enumerator[_name=_custom]',
						   pathSpecialAccessDescription: "_custom"
						  },
						  {description: Settings.prototype.allVisibleLabel,
						   instancePath: "_term[_name=_privilege]>enumerator[_name=_read]"
						  }
						 ];
	
	function PickUserAccessPanel(oldUserAccessValue, oldPathAccessValue, oldPathSpecialAccessValue, previousPanel) {
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
					return d.description === oldUserAccessValue.getDescription();
				})
				.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", true);
					
			buttons.selectAll('div.btn')
				.on('click', function(d, i)
					{
						if (d.description === oldUserAccessValue.getDescription())
							return;
						
						if (prepareClick('click', d.description))
						{
							try
							{
								var sourceObjects = [];
								var initialData = [];
								if (d.description == Settings.prototype.profileHiddenLabel)
								{
									if (oldUserAccessValue.id)
									{
										sourceObjects.push(oldUserAccessValue);
										initialData.push({ id: oldUserAccessValue.id });
									}
									if (oldPathAccessValue.id)
									{
										sourceObjects.push(oldPathAccessValue);
										initialData.push({ id: oldPathAccessValue.id });
									}
									if (oldPathSpecialAccessValue.id)
									{
										sourceObjects.push(oldPathSpecialAccessValue);
										initialData.push({ id: oldPathSpecialAccessValue.id });
									}
								}
								else if (d.description == Settings.prototype.emailVisibleLabel)
								{
									if (oldUserAccessValue.id)
									{
										if (oldUserAccessValue.description != "_find")
										{
											sourceObjects.push(oldUserAccessValue);
											initialData.push({ id: oldUserAccessValue.id,
														 instance: d.instancePath,
														 description: d.description });
										}
									}
									else
									{
										sourceObjects.push(oldUserAccessValue);
										initialData.push(
												{
													containerUUID: oldUserAccessValue.cell.parent.getValueID(),
													fieldID: oldUserAccessValue.cell.field.nameID,
													instance: d.instancePath,
													description: d.description
												});
									}
									if (oldPathAccessValue.id)
									{
										sourceObjects.push(oldPathAccessValue);
										initialData.push({ id: oldPathAccessValue.id });
									}
									if (oldPathSpecialAccessValue.id)
									{
										sourceObjects.push(oldPathSpecialAccessValue);
										initialData.push({ id: oldPathSpecialAccessValue.id });
									}
								}
								else if (d.description == Settings.prototype.pathVisibleLabel)
								{
									if (oldUserAccessValue.id)
									{
										if (oldUserAccessValue.description != "_find")
										{
											sourceObjects.push(oldUserAccessValue);
											initialData.push({ id: oldUserAccessValue.id,
														 instance: d.instancePath,
														 description: d.description });
										}
									}
									else
									{
										sourceObjects.push(oldUserAccessValue);
										initialData.push(
												{
													containerUUID: oldUserAccessValue.cell.parent.getValueID(),
													fieldID: oldUserAccessValue.cell.field.nameID,
													instance: d.instancePath,
													description: d.description
												});
									}
									if (oldPathAccessValue.id)
									{
										sourceObjects.push(oldPathAccessValue);
										initialData.push({ id: oldPathAccessValue.id,
													 instance: d.pathPrivilegePath,
													 description: d.description });
									}
									else
									{
										sourceObjects.push(oldPathAccessValue);
										initialData.push(
												{
													containerUUID: oldPathAccessValue.cell.parent.getValueID(),
													fieldID: oldPathAccessValue.cell.field.nameID,
													instance: d.pathPrivilegePath,
													description: d.pathPrivilegeDescription
												});
									}
									if (oldPathSpecialAccessValue.id)
									{
										sourceObjects.push(oldPathSpecialAccessValue);
										initialData.push({ id: oldPathSpecialAccessValue.id,
													 instance: d.pathSpecialAccessPath,
													 description: d.pathSpecialAccessDescription });
									}
									else
									{
										sourceObjects.push(oldPathSpecialAccessValue);
										initialData.push(
												{
													containerUUID: oldPathSpecialAccessValue.cell.parent.getValueID(),
													fieldID: oldPathSpecialAccessValue.cell.field.nameID,
													instance: d.pathSpecialAccessPath,
													description: d.pathSpecialAccessDescription
												});
									}
								}
								else
								{
									if (oldUserAccessValue.id)
									{
										sourceObjects.push(oldUserAccessValue);
										initialData.push({ id: oldUserAccessValue.id,
													 instance: d.instancePath,
													 description: d.description });
									}
									else
									{
										sourceObjects.push(oldUserAccessValue);
										initialData.push(
												{
													containerUUID: oldUserAccessValue.cell.parent.getValueID(),
													fieldID: oldUserAccessValue.cell.field.nameID,
													instance: d.instancePath,
													description: d.description
												});
									}
									if (oldPathAccessValue.id)
									{
										sourceObjects.push(oldPathAccessValue);
										initialData.push({ id: oldPathAccessValue.id });
									}
									if (oldPathSpecialAccessValue.id)
									{
										sourceObjects.push(oldPathSpecialAccessValue);
										initialData.push({ id: oldPathSpecialAccessValue.id });
									}
								}
								
								if (initialData.length > 0)
								{
									/* Test case: Change the public accessibility for a user from Public Profile and Path to Public Path Only. */
									cr.updateValues(initialData, sourceObjects)
										.then(function()
											{
												hidePanelRight(_this.node());
											},
											cr.syncFail);
								}
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						}
					});
		}
	}
	
	return PickUserAccessPanel;
})();

