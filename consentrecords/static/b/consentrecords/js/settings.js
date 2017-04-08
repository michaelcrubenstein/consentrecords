var Settings = (function () {
	Settings.prototype = new SitePanel();
	Settings.prototype.panelTitle = "Settings";
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

	function Settings(user) {
		var _this = this;
		this.createRoot(null, "Settings", "edit settings", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle(this.panelTitle);
		
		var panel2Div = this.appendScrollArea();
		
		var path = user.getValue("Path");
		var birthdayCell = user.getCell("Birthday");
		var oldAppendUpdateBirthdayCommands = birthdayCell.data[0].appendUpdateCommands;
		
		/* Change the birthdayCell's data command to validate the birthday and update the
			corresponding birthday in the Path object.
		 */
		birthdayCell.data[0].appendUpdateCommands = function(i, newValue, initialData, sourceObjects)
		{
			if (!newValue)
				throw new Error("Your birthday is required.");
			var birthMonth = newValue.substr(0, 7);
			if (birthMonth.length < 7)
				throw new Error("Your birthday must include a year and a month.");
			oldAppendUpdateBirthdayCommands.call(birthdayCell.data[0], i, newValue, initialData, sourceObjects);
			path.getValue("Birthday").appendUpdateCommands(0, birthMonth, initialData, sourceObjects);
		}
		
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
					birthdayCell.data[0].appendUpdateCommands = oldAppendUpdateBirthdayCommands;
				})
 			.append("span").text(crv.buttonTexts.done);

		var userPublicAccessCell = user.getCell(cr.fieldNames.publicAccess);
		var userPrimaryAdministratorCell = user.getCell(cr.fieldNames.primaryAdministrator);
		var pathPublicAccessCell = path.getCell(cr.fieldNames.publicAccess);
		var pathSpecialAccessCell = path.getCell(cr.fieldNames.specialAccess);
		var pathPrimaryAdministratorCell = path.getCell(cr.fieldNames.primaryAdministrator);
		
		user.getCell(cr.fieldNames.firstName).field.label = this.firstNameLabel;
		user.getCell(cr.fieldNames.lastName).field.label = this.lastNameLabel;
		path.getCell(cr.fieldNames.name).field.label = this.screenNameLabel;
		userPublicAccessCell.field.label = this.userPublicAccessLabel;
		
		var oldGetDescription = userPublicAccessCell.data[0].getDescription;
		userPublicAccessCell.data[0].getDescription = function() 
			{
				var oldDescription = oldGetDescription.call(this);
				if (oldDescription == cr.privileges.read ||
					oldDescription == _this.allVisibleLabel)
					return _this.allVisibleLabel;
				else if (pathPublicAccessCell.data[0].getDescription() == cr.privileges.read ||
				         oldDescription == _this.pathVisibleLabel)
				    return _this.pathVisibleLabel;
				else if (oldDescription == cr.privileges.find ||
						 oldDescription == _this.emailVisibleLabel)
					return _this.emailVisibleLabel;
				else
					return _this.profileHiddenLabel;
			};
		
		var cells = [user.getCell(cr.fieldNames.firstName),
					 user.getCell(cr.fieldNames.lastName),
					 path.getCell(cr.fieldNames.name),
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
		
		if (user.getPrivilege() === cr.privileges.administer)
		{
			var userPublicAccessValue = userPublicAccessCell.data[0];
			var pathPublicAccessValue = pathPublicAccessCell.data[0];
			var pathSpecialAccessValue = pathSpecialAccessCell.data[0];
			var pathPrimaryAdministratorValue = pathPrimaryAdministratorCell.data[0];
			
			var divs = addUniqueCellSection(userPublicAccessCell, this.userPublicAccessLabel,
				function(cell) {
					if (prepareClick('click', 'pick ' + _this.userPublicAccessLabel))
					{
						try
						{
							new PickUserAccessPanel()
								.createRoot(user, path, userPublicAccessValue, pathPublicAccessValue, pathSpecialAccessValue, pathPrimaryAdministratorValue)
								.showLeft().then(unblockClick);
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				});
			
			/* Change the contents of the div when the pathPublicAccessValue changes as well. */	
			divs.each(function()
				{
					setupOnViewEventHandler(pathPublicAccessValue, "dataChanged.cr valueDeleted.cr", this, 
						function(eventObject)
						{
							d3.select(eventObject.data).text(userPublicAccessValue.getDescription());
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
			
			setupOnViewEventHandler(userPublicAccessValue, "valueDeleted.cr dataChanged.cr", docDiv.node(), 
				updateVisibilityDocumentation);
			setupOnViewEventHandler(pathPublicAccessValue, "valueDeleted.cr dataChanged.cr", docDiv.node(), 
				updateVisibilityDocumentation);
			updateVisibilityDocumentation();
	
			function checkSharingBadge()
			{
				var cell = user.getCell(cr.fieldNames.accessRequest);
				cell.field.label = _this.accessRequestLabel;
				var badgeCount = (cell && cell.data.length > 0) ? cell.data.length : "";

				sharingButton.selectAll("span.badge").text(badgeCount);
			}
			
			var urlSection = panel2Div.append('section')
				.classed('cell edit unique', true)
				.datum(user.getCell(cr.fieldNames.email));
				
			urlSection.append('label')
				.text("Your Path");
					
			var urlList = urlSection.append("ol")
				.classed('right-label', true);
						
			var urlItem = urlList.append('li')
				.classed('site-active-text', true)
				.text("{0}/for/{1}"
					.format(window.location.origin, user.getDatum(cr.fieldNames.email)))
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
					.format(window.location.origin, user.getDatum(cr.fieldNames.email)));
			}
			setupOnViewEventHandler(user.getCell(cr.fieldNames.email), 'dataChanged.cr', urlItem.node(), 
				function()
				{
					urlItem.text("{0}/for/{1}"
						.format(window.location.origin, user.getDatum(cr.fieldNames.email)));
				});
	
			var sharingDiv = this.appendActionButton('Sharing', function() {
					if (prepareClick('click', 'Sharing'))
					{
						showClickFeedback(this);
						new SharingPanel(user, Settings.prototype.panelTitle)
							.showUp()
							.always(unblockClick);
					}
				})
				.classed('first', true);
			var sharingButton = sharingDiv.select('ol>li>div');
			sharingButton.append('span')
				.classed('badge', true);
			checkSharingBadge();
			
			setupOnViewEventHandler(user.getCell(cr.fieldNames.accessRequest), "valueDeleted.cr valueAdded.cr", 
				sharingButton.node(), checkSharingBadge);
				
			this.appendActionButton('Following', function() {
					if (prepareClick('click', 'Following'))
					{
						showClickFeedback(this);
						new FollowingPanel(user)
							.showUp()
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
						new UpdateUsernamePanel(user)
							.showUp()
							.always(unblockClick);
					}
				});
		
			this.appendActionButton('Change Password', function() {
					if (prepareClick('click', 'Change Password'))
					{
						showClickFeedback(this);
						new UpdatePasswordPanel()
							.showUp()
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
	
	PickFromListPanel.prototype.createRoot = function(datum, headerText, panelClass)
	{
		SitePanel.prototype.createRoot.call(this, datum, headerText, "list " + panelClass, revealPanelLeft);
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'pick path access panel: Cancel'))
				{
					_this.hideRight(unblockClick);
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
	
		navContainer.appendTitle(this.title);

		var panel2Div = this.appendScrollArea();
		var itemsDiv = panel2Div.append("section")
			.classed("multiple", true)
			.append("ol");
			
		return this;
	}

	function PickFromListPanel() {
		SitePanel.call(this);
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
						   instancePath: "term[name=privilege]>enumerator[name=find]"
						  },
						  {description: Settings.prototype.pathVisibleLabel,
						   instancePath: "term[name=privilege]>enumerator[name=find]",
						   pathPrivilegePath: "term[name=privilege]>enumerator[name=read]",
						   pathPrivilegeDescription: cr.privileges.read,
						   pathSpecialAccessPath: 'term[name="special access"]>enumerator[name=custom]',
						   pathSpecialAccessDescription: cr.specialAccesses.custom
						  },
						  {description: Settings.prototype.allVisibleLabel,
						   instancePath: "term[name=privilege]>enumerator[name=read]"
						  }
						 ];
	
	PickUserAccessPanel.prototype.createRoot = function(user, path, oldUserAccessValue, oldPathAccessValue, oldPathSpecialAccessValue, oldPathPrimaryAdministratorValue)
	{
		PickFromListPanel.prototype.createRoot(null, this.title, "");
		var _this = this;

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
								if (oldPathPrimaryAdministratorValue.id)
								{
									sourceObjects.push(oldPathPrimaryAdministratorValue);
									initialData.push({ id: oldPathPrimaryAdministratorValue.id });
								}
							}
							else if (d.description == Settings.prototype.emailVisibleLabel)
							{
								if (oldUserAccessValue.id)
								{
									if (oldUserAccessValue.getDescription() != cr.privileges.find &&
										oldUserAccessValue.getDescription() != Settings.prototype.pathVisibleLabel &&
										oldUserAccessValue.getDescription() != Settings.prototype.emailVisibleLabel)
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
												containerUUID: user.getInstanceID(),
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
								if (oldPathPrimaryAdministratorValue.id)
								{
									sourceObjects.push(oldPathPrimaryAdministratorValue);
									initialData.push({ id: oldPathPrimaryAdministratorValue.id });
								}
							}
							else if (d.description == Settings.prototype.pathVisibleLabel)
							{
								if (oldUserAccessValue.id)
								{
									if (oldUserAccessValue.getDescription() != cr.privileges.find &&
										oldUserAccessValue.getDescription() != Settings.prototype.pathVisibleLabel &&
										oldUserAccessValue.getDescription() != Settings.prototype.emailVisibleLabel)
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
												containerUUID: user.getInstanceID(),
												fieldID: oldUserAccessValue.cell.field.nameID,
												instance: d.instancePath,
												description: d.description
											});
								}
								sourceObjects.push(oldPathAccessValue);
								if (oldPathAccessValue.id)
								{
									initialData.push({ id: oldPathAccessValue.id,
												 instance: d.pathPrivilegePath,
												 description: d.description });
								}
								else
								{
									initialData.push(
											{
												containerUUID: path.getInstanceID(),
												fieldID: oldPathAccessValue.cell.field.nameID,
												instance: d.pathPrivilegePath,
												description: d.pathPrivilegeDescription
											});
								}
								var newInstanceID = user.getValue(cr.fieldNames.primaryAdministrator).getInstanceID();
								if (newInstanceID)
								{
									sourceObjects.push(oldPathPrimaryAdministratorValue);
									var newData;
									if (oldPathPrimaryAdministratorValue.id)
									{
										newData = { id: oldPathPrimaryAdministratorValue.id }
									}
									else
									{
										newData = { containerUUID: path.getInstanceID(),
													fieldID: oldPathPrimaryAdministratorValue.cell.field.nameID };
									}
									newData.instanceID = newInstanceID;
									newData.description = user.getValue(cr.fieldNames.primaryAdministrator).getDescription();
									initialData.push(newData);
								}
								sourceObjects.push(oldPathSpecialAccessValue);
								if (oldPathSpecialAccessValue.id)
								{
									initialData.push({ id: oldPathSpecialAccessValue.id,
												 instance: d.pathSpecialAccessPath,
												 description: d.pathSpecialAccessDescription });
								}
								else
								{
									initialData.push(
											{
												containerUUID: path.getInstanceID(),
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
												containerUUID: user.getInstanceID(),
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
								if (oldPathPrimaryAdministratorValue.id)
								{
									sourceObjects.push(oldPathPrimaryAdministratorValue);
									initialData.push({ id: oldPathPrimaryAdministratorValue.id });
								}
							}
							
							if (initialData.length > 0)
							{
								/* Test case: Change the public accessibility for a user from Public Profile and Path to Public Path Only. */
								cr.updateValues(initialData, sourceObjects)
									.then(function()
										{
											_this.hideRight(unblockClick);
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
		return this;
	}
	
	function PickUserAccessPanel() {
		PickFromListPanel.call(this);
	}
	
	return PickUserAccessPanel;
})();

var crn = {}

/* This is a message to inform you that you have been accepted as a follower by another user. */
crn.FollowerAccept = (function() {
	FollowerAccept.prototype.notification = null;
	FollowerAccept.prototype.buttonText = "<b>{0}</b> has accepted you as a follower.";
	
	FollowerAccept.prototype.appendDescription = function(buttonNode)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var user = args[0];
		
		buttonNode.innerHTML = this.buttonText.format(getUserDescription(user));
	}
	
	function FollowerAccept(d)
	{
		this.notification = d;
	}
	
	return FollowerAccept;
})();

/* This notification tells you that another user has asked to follow you.
	Clicking this message takes you to settings.
 */
crn.FollowerRequest = (function() {
	FollowerRequest.prototype.notification = null;
	FollowerRequest.prototype.buttonText = "<b>{0}</b> has asked to follow you.";
	
	FollowerRequest.prototype.appendDescription = function(buttonNode)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var user = args[0];
		
		buttonNode.innerHTML = this.buttonText.format(getUserDescription(user));
		
		$(buttonNode).click(function(e)
			{
				if (prepareClick('click', "Follower Request"))
				{
					try
					{
						showClickFeedback(this);
						new SharingPanel(cr.signedinUser, NotificationsPanel.prototype.panelTitle, revealPanelLeft)
							.showLeft()
							.always(unblockClick);
					}
					catch(err)
					{
						cr.syncFail(err);
					}
				}
				
				e.preventDefault();
			});
	}
	
	function FollowerRequest(d)
	{
		this.notification = d;
	}
	
	return FollowerRequest;
})();

crn.ExperienceCommentRequested = (function() {
	ExperienceCommentRequested.prototype.notification = null;
	ExperienceCommentRequested.prototype.buttonText = "<b>{0}</b> has a question about your {1} experience.";

	ExperienceCommentRequested.prototype.appendDescription = function(buttonNode)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var path = args[0];
		var experienceInstance = crp.getInstance(args[1].getInstanceID());
		var experience = experienceInstance.parent().getCell("More Experience")
							.data.find(function(v) { return v.instance() == experienceInstance; });
		var comments = experienceInstance.getValue("Comments");
		
		var _this = this;
		$.when(path.instance().parentPromise(), comments.promiseCellsFromCache(["Comment/Comment Request"]))
			.then(function()
				{
					var commentInstanceID = args[2].getInstanceID();
					var comment = comments.getCell("Comment")
						.data.find(function(v) { return v.getInstanceID() == commentInstanceID; });
		
					buttonNode.innerHTML = _this.buttonText.format(getPathDescription(path), experience.getDescription());
		
					$(buttonNode).click(function(e)
						{
							if (prepareClick('click', "Experience Comment Requested"))
							{
								try
								{
									showClickFeedback(this);
						
									var newPanel = new ExperienceCommentsPanel(new FlagController(experience));
									newPanel.startEditing();
									try 
									{
										newPanel.promise = newPanel.promise.then(function()
											{
												try
												{
													newPanel.focusOnComment(comment.id);
												}
												catch (err) { cr.asyncFail(err); }
											});
									}
									catch(err)
									{
										cr.asyncFail(err);
									}
									newPanel.showLeft()
										.always(unblockClick);
								}
								catch(err)
								{
									cr.syncFail(err);
								}
							}
				
							e.preventDefault();
						});
				},
				cr.asyncFail);
	}
	
    function ExperienceCommentRequested(d)
    {
    	this.notification = d;
    }
    
    return ExperienceCommentRequested;
})();

var NotificationsPanel = (function () {
	NotificationsPanel.prototype = new SitePanel();
	NotificationsPanel.prototype.panelTitle = "Notifications";
	NotificationsPanel.prototype.noItemsDescription = "You have no notifications.";
	
	NotificationsPanel.prototype.user = null;
	
	NotificationsPanel.prototype.noItemsDiv = null;
	
	NotificationsPanel.prototype.checkNoItems = function()
	{
		var text = this.noItemsDescription;
		this.noItemsDiv.text(text);
		this.noItemsDiv.style('display', (this.user.getCell(cr.fieldNames.notification).data.length !== 0) ? 'none' : null);
	}
	
	function NotificationsPanel(user) {
		var _this = this;
		this.user = user;
		
		this.createRoot(null, "NotificationsPanel", "edit notifications", revealPanelUp);

		var navContainer = this.appendNavContainer();

		var doneButton = navContainer.appendRightButton();
			
		navContainer.appendTitle(this.panelTitle);
		
		var panel2Div = this.appendScrollArea();
		
		doneButton.on("click", function()
				{
					panel2Div.handleDoneEditingButton.call(this);
				})
 			.append("span").text(crv.buttonTexts.done);

		var cells = [user.getCell(cr.fieldNames.notification)
					 ];
					 
		var sections = this.mainDiv.appendSections(cells)
			.classed("cell edit", true)
			.classed("unique", function(cell) { return cell.isUnique(); })
			.classed("multiple", function(cell) { return !cell.isUnique(); });
			
		this.noItemsDiv = sections.append('div')
			.classed('no-results', true)
			.style('display', 'none');

		itemCells = sections.append("ol")
			.classed("cell-items", true);
	
		var items = appendItems(itemCells, user.getCell(cr.fieldNames.notification).data);
		
		appendConfirmDeleteControls(items);
	
		var buttons = appendRowButtons(items)
			.classed('is-fresh', function(d)
				{
					var e = d.getValue(cr.fieldNames.isFresh);
					return e && e.getDescription() == cr.booleans.yes;
				});

		var deleteControls = this.appendDeleteControls(buttons);

		buttons.append('div').classed("left-expanding-div description-text", true)
			.each(function(d)
				{
					var name = d.getDatum(cr.fieldNames.name);
					if (name && name.indexOf('crn.') != 0)
						name = null;
					
					if (name)
					{
						var arr = name.split(".")[1];
						var f = crn[arr];
						new f(d).appendDescription(this);
					}
					else
						d3.select(this).text(d.getDescription());
				});
				
		this.showDeleteControls($(deleteControls[0]), 0);
		
		function checkIsFresh()
		{
			crp.promise({path: "term[name=boolean]"})
				.then(function(terms)
					{
						try
						{
							termNo = terms[0].getCell(cr.fieldNames.enumerator).data.find(function(d)
								{
									return d.getDescription() == cr.booleans.no;
								});
							var updateData = [];
							var sourceObjects = [];
							var scrollParent = $(itemCells.node()).scrollParent();
							var scrollParentTop = scrollParent.offset().top;
							var innerTop = scrollParent.scrollTop();
							var innerBottom = innerTop + scrollParent.innerHeight();
							items.each(function(d)
								{
									var itemTop = $(this).offset().top - scrollParentTop;
									if (itemTop < innerBottom &&
										itemTop >= innerTop)
									{
										var v = d.getValue(cr.fieldNames.isFresh);
										if (v && v.getDescription() == cr.booleans.yes)
										{
											v.appendUpdateCommands(0, termNo, updateData, sourceObjects);
										}
									}
								});
							if (updateData.length > 0)
							{
								cr.updateValues(updateData, sourceObjects)
									.fail(cr.asyncFail);
							}
						}
						catch(err)
						{
							cr.asyncFail(err);
						}
					},
					cr.asyncFail);
		}
					
		$(panel2Div.node()).on('resize.cr', checkIsFresh);
		$(itemCells.node()).scroll(checkIsFresh);
		
		user.getCell(cr.fieldNames.notification).on("valueDeleted.cr", panel2Div.node(), 
			function() { _this.checkNoItems(); });
		this.checkNoItems();
	}
	
	return NotificationsPanel;
})();

