var Settings = (function () {
	Settings.prototype = new EditPanel();
	Settings.prototype.panelTitle = "Settings";
	Settings.prototype.firstNameLabel = "First Name";
	Settings.prototype.lastNameLabel = "Last Name";
	Settings.prototype.userPublicAccessLabel = "Profile Visibility";
	Settings.prototype.accessRequestLabel = "Access Requests";
	Settings.prototype.screenNameLabel = "Screen Name";
	Settings.prototype.birthdayLabel = "Birthday";
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

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	Settings.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.birthdayEditor.wheelReveal &&
			this.birthdayEditor.wheelReveal.isVisible())
		{
			this.birthdayEditor.hideWheel(done);
			return true;
		}
		else
			return false;
	}
	
	function Settings(user) {
		var _this = this;
		this.createRoot(user, "Settings", revealPanelUp);
		this.panelDiv.classed("settings", true);

		var doneButton = this.navContainer.appendRightButton();
			
		this.navContainer.appendTitle(this.panelTitle);
		
		var path = user.path();
		doneButton.on("click", function()
			{
				if (prepareClick('click', 'Settings done'))
				{
					showClickFeedback(this);
		
					/* Build up an update for initialData. */
					var changes = {}
					_this.appendTextChanges(firstNameSection, user.firstName(), changes, 'first name');
					_this.appendTextChanges(lastNameSection, user.lastName(), changes, 'last name');
					var newScreenName = screenNameSection.selectAll('input').node().value;
					if (newScreenName != path.name())
					    changes['path'] = {'screen name': newScreenName};
					_this.appendDateChanges(_this.birthdayEditor, user.birthday(), changes, 'birthday')
					
					if (user.privilege() === cr.privileges.administer)
					{
						var pathChanges = {};
						_this.appendEnumerationChanges(publicAccessSection, pathSpecialAccess, path.specialAccess(), pathChanges, 'special access');
						_this.appendEnumerationChanges(publicAccessSection, userPublicAccess, user.publicAccess(), changes, 'public access');
						_this.appendEnumerationChanges(publicAccessSection, pathPublicAccess, path.publicAccess(), pathChanges, 'public access');
						if (Object.keys(pathChanges).length)
							changes['path'] = pathChanges;
					}
					
					
					/* Send the update to the server. */
					user.update(changes)
						.then(function() { _this.hide(); },
						      cr.syncFail)
				}
			})
		.append("span").text(crv.buttonTexts.done);

		var getAccessDescription = function() 
			{
				if (user.publicAccess() == cr.privileges.read)
					return _this.allVisibleLabel;
				else if (path.publicAccess() == cr.privileges.read)
				    return _this.pathVisibleLabel;
				else if (user.publicAccess() == cr.privileges.find)
					return _this.emailVisibleLabel;
				else
					return _this.profileHiddenLabel;
			};
		
		var pathSpecialAccess = function(label)
		{
			if (label == _this.pathVisibleLabel)
				return cr.specialAccesses.custom;
			else
				return "";
		}
			
		var userPublicAccess = function(label)
		{
			if (label == _this.allVisibleLabel)
				return cr.privileges.read;
			else if (label == _this.pathVisibleLabel ||
					 label == _this.emailVisibleLabel)
				return cr.privileges.find;
			else
				return "";
		}
		
		var pathPublicAccess = function(label)
		{
			if (label == _this.pathVisibleLabel)
				return cr.privileges.read;
			else
				return "";
		}
		
		var firstNameSection = this.mainDiv.append('section')
			.datum(user)
			.classed('cell edit unique', true);
		this.appendTextEditor(firstNameSection, this.firstNameLabel, user.firstName(), 'text');
				 
		var lastNameSection = this.mainDiv.append('section')
			.datum(user)
			.classed('cell edit unique first', true);
		this.appendTextEditor(lastNameSection, this.lastNameLabel, user.lastName(), 'text');
				 
		var screenNameSection = this.mainDiv.append('section')
			.datum(path)
			.classed('cell edit unique first', true);
		this.appendTextEditor(screenNameSection, this.screenNameLabel, path.name(), 'text');
				 
		var birthdaySection = this.mainDiv.append('section')
			.datum(user)
			.classed('cell edit unique first', true);
		birthdaySection.append('label')
			.text(this.birthdayLabel);
		
		var minDate = new Date();
		minDate.setUTCFullYear(minDate.getUTCFullYear() - 100);
		minDate.setMonth(0);
		minDate.setDate(1);
			
		this.birthdayEditor = this.appendDateEditor(birthdaySection, this.birthdayLabel, user.birthday(), minDate, new Date());

		var publicAccessSection = null;
		var publicAccessSectionTextContainer = null;
		
		var appendUserActions = function()
		{
			if (user == cr.signedinUser)
			{
				_this.appendActionButton('Change Email', function() {
						if (prepareClick('click', 'Change Email'))
						{
							showClickFeedback(this);
							new UpdateUsernamePanel(user)
								.showUp()
								.always(unblockClick);
						}
					});
		
				_this.appendActionButton('Change Password', function() {
						if (prepareClick('click', 'Change Password'))
						{
							showClickFeedback(this);
							new UpdatePasswordPanel()
								.showUp()
								.always(unblockClick);
						}
					});

				_this.appendActionButton('Sign Out', function() {
						if (prepareClick('click', 'Sign Out'))
						{
							showClickFeedback(this);
							sign_out(syncFailFunction);
						}
					})
					.classed('first', true);
			}
		}

		if (user.privilege() === cr.privileges.administer)
		{
			user.promiseGrants()
				.then(function()
				{
					publicAccessSection = _this.mainDiv.append('section')
						.classed('cell edit unique first', true)
						.datum(user)
						.on("click", 
							function(cell) {
								if (prepareClick('click', 'pick ' + _this.userPublicAccessLabel))
								{
									try
									{
										var panel = new PickUserAccessPanel();
										panel.createRoot(user, path, publicAccessSectionTextContainer.text())
											 .showLeft().then(unblockClick);
									
										$(panel.node()).on('itemPicked.cr', function(eventObject, newDescription)
											{
												publicAccessSectionTextContainer.text(newDescription);
												updateVisibilityDocumentation();
											});
									}
									catch(err)
									{
										cr.syncFail(err);
									}
								}
						});
				
					publicAccessSection.append('label')
						.text(_this.userPublicAccessLabel);
			
					var items = _this.appendEnumerationEditor(publicAccessSection, getAccessDescription());
					publicAccessSectionTextContainer = publicAccessSection.selectAll('div.description-text');
					crf.appendRightChevrons(items);	
			
					var docSection = _this.mainDiv.append('section')
						.classed('cell documentation', true);
			
					var docDiv = docSection.append('div');
			
					var updateVisibilityDocumentation = function()
					{
						var description = publicAccessSectionTextContainer.text();
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
			
					updateVisibilityDocumentation();
	
					function checkSharingBadge()
					{
						var grs = user.userGrantRequests();
						var badgeCount = (grs && grs.length > 0) ? grs.length : "";

						sharingButton.selectAll("span.badge").text(badgeCount);
					}
			
					var urlSection = _this.mainDiv.append('section')
						.classed('cell edit unique', true)
						.datum(user.emails()[0].text());
				
					urlSection.append('label')
						.text("Your Path");
					
					var urlList = crf.appendItemList(urlSection);
						
					var urlItem = urlList.append('li')
						.classed('site-active-text', true)
						.append('div')
						.classed('growable unselectable', true)
						.text("{0}/for/{1}"
							.format(window.location.origin, user.emails()[0].text()))
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
							.format(window.location.origin, user.emails()[0].text()));
					}
					setupOnViewEventHandler(user, 'changed.cr', urlItem.node(), 
						function()
						{
							urlItem.text("{0}/for/{1}"
								.format(window.location.origin, user.emails()[0].text()));
						});
	
					var sharingDiv = _this.appendActionButton('Sharing', function() {
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
			
					setupOnViewEventHandler(user, "userGrantRequestDeleted.cr userGrantRequestAdded.cr", 
						sharingButton.node(), checkSharingBadge);
				
					_this.appendActionButton('Following', function() {
							if (prepareClick('click', 'Following'))
							{
								showClickFeedback(this);
								new FollowingPanel(user)
									.showUp()
									.always(unblockClick);
							}
						});
				
					appendUserActions();
				});
		}
		else
			appendUserActions(); /* In case the current user isn't their own administrator. */
	}
	
	return Settings;
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
	
	PickUserAccessPanel.prototype.createRoot = function(user, path, oldDescription)
	{
		PickFromListPanel.prototype.createRoot.call(this, null, this.title, "");
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
				return d.description === oldDescription;
			})
			.insert("span", ":first-child").classed("glyphicon glyphicon-ok", true);
				
		items.on('click', function(d, i)
				{
					if (d.description === oldDescription)
						return;
					
					if (prepareClick('click', d.description))
					{
						try
						{
							$(_this.node()).trigger('itemPicked.cr', d.description);
							_this.hideRight(unblockClick);
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
	
	FollowerAccept.parseArguments = function(d)
	{
		var user = new cr.User();
		user.setData(d[0]);
		
		return [user];
	}
	
	FollowerAccept.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var user = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format(""));
		
		q.add(function()
			{
				$.when(user.promisePath())
				 .then(function()
				 	{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(user.caption());
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

	ExperienceCommentRequested.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var experience = new cr.Experience();
		experience.setData(d[1]);
		
		var comment = new cr.Comment();
		comment.setData(d[2]);
		
		return [path, experience, comment];
	}
	
	ExperienceCommentRequested.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		
		var _this = this;
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()));
		
		q.add(function()
			{
				path.promiseUser()
				 .then(function()
					{
						spinnerSpan.datum().stop();
						spinnerSpan.remove();
						textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description());
	
						$(buttonNode).click(function(e)
							{
								if (prepareClick('click', "Experience Comment Requested"))
								{
									try
									{
										showClickFeedback(this);
					
										var experienceInstance = crp.getInstance(args[1].id());
										var newPanel = new ExperienceCommentsPanel(new FlagController(experienceInstance));
										newPanel.startEditing();
										try 
										{
											newPanel.promise = newPanel.promise.then(function()
												{
													try
													{
														var comments = experienceInstance.comments();
														var commentInstanceID = args[2].id();
														var comment = comments.find(function(v) { return v.id() == commentInstanceID; });
	
														newPanel.focusOnComment(comment.id());
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

	ExperienceQuestionAnswered.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var experience = new cr.Experience();
		experience.setData(d[1]);
		
		return [path, experience];
	}
	
	ExperienceQuestionAnswered.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()));
		
		q.add(function()
			{
				$.when(path.promiseUser())
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description());
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Question Answered"))
									{
										try
										{
											showClickFeedback(this);
											$.when(path.promiseExperiences())
												.then(function()
													{
														return checkOfferingCells(args[1]);
													})
												.then(function()
													{
														var experienceInstance = crp.getInstance(args[1].id());
														var newPanel = new ExperienceCommentsPanel(new FlagController(experienceInstance));
												
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

	ExperienceSuggestion.parseArguments = function(d)
	{
		var path = new cr.Path();
		path.setData(d[0]);
		
		var service = new cr.Service();
		service.setData(d[1]);
		
		var comment = new cr.Comment();
		comment.setData(d[2]);
		
		return [path, experience, comment];
	}
	
	ExperienceSuggestion.prototype.appendDescription = function(buttonNode, q)
	{
		var args = this.notification.args();
		var path = args[0];
		var phaseDescription = "an experience" 
		
		var _this = this;
		var spinnerSpan = this.appendSpinner(buttonNode);
		var textSpan = this.appendTextSpan(buttonNode, spinnerSpan, 
			_this.buttonText.format("", args[1].description()), phaseDescription);
		
		q.add(function()
			{
				path.promiseUser()
					.then(function()
						{
							spinnerSpan.datum().stop();
							spinnerSpan.remove();
							textSpan.node().innerHTML = _this.buttonText.format(path.caption(), args[1].description(), phaseDescription);
		
							$(buttonNode).click(function(e)
								{
									if (prepareClick('click', "Experience Suggestion"))
									{
										try
										{
											showClickFeedback(this);
					
											var phase = "Previous";
											var experience = new ExperienceController(cr.signedinUser.path())
											experience.initDateRange(phase);
											var tag = crp.getInstance(args[1].id());
											var services = [new ExperienceService()];
											services[0].service(tag);
											experience.experienceServices(services);
											new NewExperiencePanel(experience, revealPanelLeft)
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
		this.noItemsDiv.style('display', (this.user.notifications().length !== 0) ? 'none' : null);
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

		var cells = [user.notifications()];
		
		
		var sections = this.mainDiv.append('section')
		    .datum(user.notifications())
			.classed("cell edit", true)
			.classed("multiple", true);
			
		this.noItemsDiv = sections.append('div')
			.classed('no-results', true)
			.style('display', 'none');

		itemCells = crf.appendItemList(sections)
			.classed('deletable-items', true);
	
		var items = appendItems(itemCells, user.notifications().reverse());
		
		items.classed('is-fresh', function(d)
				{
					return d.isFresh() == cr.booleans.yes;
				});

		var deleteControls = crf.appendDeleteControls(items);

		var q = new Queue();
		items.each(function(d)
				{
					var name = d.name();
					if (name && name.indexOf('crn.') != 0)
						name = null;
					
					if (name)
					{
						var f = d.controller();
						if (f)
						{
							new f(d).appendDescription(this, q);
							crf.appendRightChevrons(d3.select(this));
						}
						else
							d3.select(this).text(d.description());
					}
					else
						d3.select(this).text(d.description());
				});
				
		crf.appendConfirmDeleteControls(items);
		crf.showDeleteControls($(deleteControls[0]), 0);
		
		function checkIsFresh()
		{
			try
			{
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
							var v = d.isFresh();
							if (v == cr.booleans.yes)
							{
								d.appendUpdateIsFreshCommand(cr.booleans.no, updateData, sourceObjects);
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
		}
					
		$(panel2Div.node()).on('resize.cr', checkIsFresh);
		$(itemCells.node()).scroll(checkIsFresh);
		
		user.on("notificationDeleted.cr", panel2Div.node(), 
			function() { _this.checkNoItems(); });
		this.checkNoItems();
	}
	
	return NotificationsPanel;
})();

