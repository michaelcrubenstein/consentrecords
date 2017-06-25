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
		
		var path = user.path();
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
					 path.getCell(cr.fieldNames.name)
					 ];
					 
		this.showEditCells(cells, function() { return false; })
			.classed('first', function(d, i) { return i != 1; });
		this.showEditCells([birthdayCell])
			.classed('first', true);
		
		var addUniqueCellSection = function(cell, label, clickFunction)
		{
			var sectionPanel = panel2Div.append('section')
				.classed('cell edit unique first', true)
				.datum(cell)
				.on("click", clickFunction);
				
			sectionPanel.append('label')
				.text(label);
			
			var itemsDiv = crf.appendItemList(sectionPanel);

			var items = appendItems(itemsDiv, cell.data);
	
			var divs = appendButtonDescriptions(items)
				.classed('unselectable', true)
				.each(_pushTextChanged);
				
			crf.appendRightChevrons(items);	
			
			return divs;
		}
		
		if (user.privilege() === cr.privileges.administer)
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
					
			var urlList = crf.appendItemList(urlSection);
						
			var urlItem = urlList.append('li')
				.classed('site-active-text', true)
				.append('div')
				.classed('growable unselectable', true)
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

		var section = this.appendScrollArea().append("section")
			.classed("cell multiple", true);
		crf.appendItemList(section)
			.classed('hover-items', true);
			
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
	
		var items = itemsDiv.selectAll('li')
			.data(this.buttonData)
			.enter()
			.append('li');
		
		items.append("div")
			.classed("description-text growable unselectable", true)
			.text(function(d) { return d.description; });
				
		items.filter(function(d, i)
			{
				return d.description === oldUserAccessValue.getDescription();
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
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

crn.Notification = (function() {
	Notification.prototype.notification = null;
	
	Notification.prototype.appendSpinner = function(buttonNode)
	{
		var child = d3.select(buttonNode).append('span');
		var opts = {
		  lines: 13 // The number of lines to draw
		, length: 4 // The length of each line
		, width: 2 // The line thickness
		, radius: 5 // The radius of the inner circle
		, scale: 0.8 // Scales overall size of the spinner
		, corners: 1 // Corner roundness (0..1)
		, color: '#000' // #rgb or #rrggbb or array of colors
		, opacity: 0.25 // Opacity of the lines
		, rotate: 0 // The rotation offset
		, direction: 1 // 1: clockwise, -1: counterclockwise
		, speed: 1 // Rounds per second
		, trail: 60 // Afterglow percentage
		, fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
		, zIndex: 2e9 // The z-index (defaults to 2000000000)
		, className: 'spinner' // The CSS class to assign to the spinner
		, top: '11px' // Top position relative to parent
		, left: '9px' // Left position relative to parent
		, shadow: false // Whether to render a shadow
		, hwaccel: false // Whether to use hardware acceleration
		, position: 'relative' // Element positioning
		, display: 'inline-block'
		}
		var spinner = new Spinner(opts).spin(child.node());
		child.datum(spinner);
		return child;
	}
	
	Notification.prototype.appendTextSpan = function(buttonNode, spinnerSpan, innerHTML)
	{
		var textSpan = d3.select(buttonNode).append('p')
			.classed('growable unselectable', true);
		
		textSpan.node().innerHTML = innerHTML;
		spinnerSpan.style('display', 'inline-block')
			.style('height', "{0}px".format($(textSpan.node()).height()))
			.style('width', "{0}px".format(16));	/* 16 = The width of the spinner plus 4px padding */
		return textSpan;
	}
	
	function Notification(d)
	{
		this.notification = d;
	}
	
	return Notification;
})();



/* This is a message to inform you that you have been accepted as a follower by another user. */
crn.FollowerAccept = (function() {
	FollowerAccept.prototype = new crn.Notification();
	FollowerAccept.prototype.buttonText = "<b>{0}</b> has accepted you as a follower.";
	
	FollowerAccept.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var user = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format(""));
		
		q.add(function()
			{
				$.when(user.promiseCellsFromCache())
				 .then(function()
				 	{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(getUserDescription(user));
						$(buttonNode).click(function(e)
							{
								if (prepareClick('click', "Follower Accepted"))
								{
									try
									{
										showClickFeedback(this);
										showUser(user);
									}
									catch(err)
									{
										cr.syncFail(err);
									}
								}
	
								e.preventDefault();
							});
					})
				 .always(function() {q.dequeue()});
				return false;
			});
	}
	
	function FollowerAccept(d)
	{
		crn.Notification.call(this, d);
	}
	
	return FollowerAccept;
})();

/** This notification tells you that another user has asked to follow you.
	Clicking this message takes you to settings.
	
	The arguments are: The path of the user making the request, the experience and the 
		comment instance being requested.
 */
crn.ExperienceCommentRequested = (function() {
	ExperienceCommentRequested.prototype = new crn.Notification();
	ExperienceCommentRequested.prototype.buttonText = "<b>{0}</b> has a question about your {1} experience.";

	ExperienceCommentRequested.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var path = args[0];
		
		var _this = this;
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].getDescription()));
		
		q.add(function()
			{
				$.when(path.instance().parentPromise())
				 .then(function()
					{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(getPathDescription(path), args[1].getDescription());
	
						$(buttonNode).click(function(e)
							{
								if (prepareClick('click', "Experience Comment Requested"))
								{
									try
									{
										showClickFeedback(this);
					
										var experienceInstance = crp.getInstance(args[1].getInstanceID());
										var experience = experienceInstance.parent().getCell("More Experience")
															.data.find(function(v) { return v.instance() == experienceInstance; });
										var newPanel = new ExperienceCommentsPanel(new FlagController(experience));
										newPanel.startEditing();
										try 
										{
											newPanel.promise = newPanel.promise.then(function()
												{
													try
													{
														var comments = experienceInstance.getValue("Comments");
														var commentInstanceID = args[2].getInstanceID();
														var comment = comments.getCell("Comment")
															.data.find(function(v) { return v.getInstanceID() == commentInstanceID; });
	
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
					cr.asyncFail)
				 .always(function() {q.dequeue(); });
			   return false;
			});
	}
	
    function ExperienceCommentRequested(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceCommentRequested;
})();

crn.ExperienceQuestionAnswered = (function() {
	ExperienceQuestionAnswered.prototype = new crn.Notification();
	ExperienceQuestionAnswered.prototype.buttonText = "<b>{0}</b> has answered a question you asked about their {1} experience.";

	ExperienceQuestionAnswered.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var path = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].getDescription()));
		
		q.add(function()
			{
				$.when(path.instance().parentPromise())
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(getPathDescription(path), args[1].getDescription());
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Question Answered"))
									{
										try
										{
											showClickFeedback(this);
											$.when(path.instance().promiseCellsFromCache(), args[1].promiseCellsFromCache())
												.then(function()
													{
														return checkOfferingCells(args[1]);
													})
												.then(function()
													{
														var experienceInstance = crp.getInstance(args[1].getInstanceID());
														var experience = path.instance().getCell("More Experience")
																			.data.find(function(v) { return v.instance() == experienceInstance; });
														var newPanel = new ExperienceCommentsPanel(new FlagController(experience));
												
														newPanel.showLeft()
															.always(unblockClick);
													},
													cr.syncFail);
										}
										catch(err)
										{
											cr.syncFail(err);
										}
									}
				
									e.preventDefault();
								});
						},
						cr.asyncFail)
				 .always(function() { q.dequeue(); });
				 return false;
			});
	}
	
    function ExperienceQuestionAnswered(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceQuestionAnswered;
})();

crn.ExperienceSuggestion = (function() {
	ExperienceSuggestion.prototype = new crn.Notification();
	ExperienceSuggestion.prototype.buttonText = "<b>{0}</b> suggests: add {2} with the {1} tag to your path.";

	ExperienceSuggestion.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.getCell(cr.fieldNames.argument).data;
		var path = args[0];
		var phaseInstance = args.length > 2 && args[2];
		var phaseDescription;
		
		if (phaseInstance)
		{
			if (phaseInstance.getDescription() == "Goal")
				phaseDescription = "a goal";
			else
				phaseDescription = "an experience";
		}
		else
			phaseDescription = "an experience" 
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].getDescription()), phaseDescription);
		
		q.add(function()
			{
				$.when(path.instance().parentPromise(), )
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(getPathDescription(path), args[1].getDescription(), phaseDescription);
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Suggestion"))
									{
										try
										{
											showClickFeedback(this);
					
											var phase = phaseInstance ? phaseInstance.getDescription() : "Previous";
											var experience = new Experience(cr.signedinUser.path())
											experience.initDateRange(phase);
											var tag = crp.getInstance(args[1].getInstanceID());
											experience.services.push(new ReportedObject({name: tag.getDescription(), pickedObject: tag}));
											new NewExperiencePanel(experience, experience.getPhase(), revealPanelLeft)
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
						},
						cr.asyncFail)
				 .always(function() { q.dequeue(); });
				 return false;
			});
	}
	
    function ExperienceSuggestion(d)
    {
    	crn.Notification.call(this, d);
    }
    
    return ExperienceSuggestion;
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

		itemCells = crf.appendItemList(sections)
			.classed('deletable-items', true);
	
		var items = appendItems(itemCells, user.getCell(cr.fieldNames.notification).data.reverse());
		
		items.classed('is-fresh', function(d)
				{
					var e = d.getValue(cr.fieldNames.isFresh);
					return e && e.getDescription() == cr.booleans.yes;
				});

		var deleteControls = crf.appendDeleteControls(items);

		var q = new Queue();
		items.each(function(d)
				{
					var name = d.getDatum(cr.fieldNames.name);
					if (name && name.indexOf('crn.') != 0)
						name = null;
					
					if (name)
					{
						var arr = name.split(".")[1];
						var f = crn[arr];
						if (f)
						{
							new f(d).appendDescription(this, q);
							crf.appendRightChevrons(d3.select(this));
						}
						else
							d3.select(this).text(d.getDescription());
					}
					else
						d3.select(this).text(d.getDescription());
				});
				
		crf.appendConfirmDeleteControls(items);
		crf.showDeleteControls($(deleteControls[0]), 0);
		
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

