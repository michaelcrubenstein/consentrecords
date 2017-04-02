/* RequestFollowPanel is used to specify the email address of a user the currently logged-in
	user wants to follow. */
var RequestFollowPanel = (function() {
	RequestFollowPanel.prototype = new SitePanel();
	RequestFollowPanel.prototype.followingPanel = null;
	RequestFollowPanel.prototype.title = "Ask to Follow";
	RequestFollowPanel.prototype.emailDocumentation = 
		'If you know the email address of someone you want to follow, you can request access to their profile.';
	RequestFollowPanel.prototype.badEmailMessage =
		'Please specify a valid email address.';
	
	function RequestFollowPanel(user, followingPanel) {
		var _this = this;
		this.followingPanel = followingPanel;
		this.createRoot(null, this.title, "list", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on('click', function()
				{
					if (prepareClick('click', 'Cancel {0}'.format(_this.title)))
					{
						_this.hide();
					}
				})
			.append('span').text('Cancel');
		
		navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick('click', 'request to follow user'))
				{
					var done = function()
					{
						_this.followingPanel.showPendingObjects([
							{text: email, getDescription: function() { return email; }}]);
						_this.followingPanel._pendingSection.selectAll('li').sort(
							function(a, b)
							{
								return a.getDescription().localeCompare(b.getDescription());
							}
						);
						_this.followingPanel._noPendingResultsDiv.style('display', 'none');
						_this.hide();
						bootstrap_alert.success("Access to {0} has been requested.".format(email),
																		  ".alert-container");
					}
					
					try
					{
						var email = d3.select(_this.node()).selectAll('input').node().value;
						function validateEmail(email) 
						{
							var re = /\S+@\S+\.\S\S+/;
							return re.test(email);
						}
						
						if (!validateEmail(email))
						{
							syncFailFunction(_this.badEmailMessage);
						}
						else
						{
							cr.requestAccess(user, 'user[email="{0}"]'.format(email), done, syncFailFunction);
						}
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
		    .append("span").text("Request");
		
		navContainer.appendTitle(this.title);
		
		var panel2Div = this.appendScrollArea();

		var sectionPanel = panel2Div.append('section')
			.classed('cell edit unique', true);
			
		var itemsDiv = sectionPanel.append("ol");

		var divs = itemsDiv.append("li")
			.classed("string-input-container", true);	// So that each item appears on its own row.
			
		var emailInput = divs.append("input")
			.attr("type", "email")
			.attr("placeholder", 'Email');
			
		var docSection = panel2Div.append('section')
			.classed('cell documentation', true);
			
		var docDiv = docSection.append('div')
			.text(this.emailDocumentation);
	}
	
	return RequestFollowPanel;
})();

/* FollowingPanel is used to identify and manage the users that the currently logged-in
	user is following. */
var FollowingPanel = (function() {
	FollowingPanel.prototype = new SitePanel();
	FollowingPanel.prototype.user = null;
	FollowingPanel.prototype._pendingSection = null;
	FollowingPanel.prototype._noPendingResultsDiv = null;
	FollowingPanel.prototype._foundPendingRequests = null;
	FollowingPanel.prototype._followingSection = null;
	FollowingPanel.prototype._noFollowingResultsDiv = null;
	FollowingPanel.prototype._foundFollowingRequests = null;
	
	FollowingPanel.prototype.showPendingObjects = function(foundObjects)
	{
		var _this = this;
		var divs = this._pendingChunker.appendButtonContainers(foundObjects);
		appendConfirmDeleteControls(divs, function(d)
			{
				var _thisItem = $(this).parents('li')[0];
				if (prepareClick('click', 'delete access request'))
				{
					var path;
					if (d.getInstanceID)
						path = d.getInstanceID()
					else
						path = 'user[email={0}]'.format(d.getDescription())
					path += '/{0}/{1}'.format(cr.fieldNames.accessRequest, _this.user.getInstanceID());
					cr.getData({path: path})
						.then(function(values)
							{
								if (values.length > 0)
								{
									values[0].deleteValue()
										.then(
										function(v)
										{
											removeItem(_thisItem,
												function()
												{
													_this._foundPendingRequests.splice(_this._foundPendingRequests.indexOf(d), 1);
													_this._noPendingResultsDiv.style('display', _this._foundPendingRequests.length === 0 ? null : 'none');
													unblockClick();
												});
										},
										cr.syncFail);
								}
								else
									cr.syncFail("Error: this access request was not found");
							},
							cr.syncFail);
				}
			});
		var buttons = appendRowButtons(divs);
		var deleteControls = this.appendDeleteControls(buttons);
		appendButtonDescriptions(buttons);
		if (!this.inEditMode)
			this.hideDeleteControlsNow($(deleteControls[0]));
		else
			this.showDeleteControls($(deleteControls[0]), 0);
		
		return buttons;
	}

	FollowingPanel.prototype.getPendingRequestsDone = function(foundObjects, startVal)
	{
		if (this._foundPendingRequests === null)
			this._foundPendingRequests = foundObjects;
		else
			this._foundPendingRequests = this._foundPendingRequests.concat(foundObjects);
		this.showPendingObjects(foundObjects);
		this._noPendingResultsDiv.style('display', this._foundPendingRequests.length === 0 ? null : 'none');
		return true;
	}
	
	FollowingPanel.prototype.showFollowingObjects = function(foundObjects)
	{
		var _this = this;
		var sections = this._followingChunker.appendButtonContainers(foundObjects);
		var buttons = appendViewButtons(sections, function(buttons)
			{
				appendRightChevrons(buttons);
				
				buttons.append("div")
					.classed("info-button right-fixed-width-div", true)
					.on("click", function(user) {
						if (prepareClick('click', 'compare to: ' + user.getDescription()))
						{
							user.promiseCells([])
								.then(function()
								{
									try
									{
										new ComparePathsPanel(_this.user, user, _this.node())
											.showUp()
											.always(unblockClick);
									}
									catch(err)
									{
										cr.syncFail(err);
									}
								},
								cr.syncFail);
						}
						d3.event.preventDefault();
						d3.event.stopPropagation();
					})
					.append("img")
					.attr("src", compareImagePath);
		
				buttons.append('div').classed("left-expanding-div description-text", true)
					.text(_getDataDescription);
			})
			.on("click", function(user)
			{
				if (prepareClick('click', 'show user'))
				{
					showUser(user, _this.node());
				}
			});
			
		return buttons;
	}

	FollowingPanel.prototype.getFollowingRequestsDone = function(foundObjects, startVal)
	{
		if (this._foundFollowingRequests === null)
			this._foundFollowingRequests = foundObjects;
		else
			this._foundFollowingRequests = this._foundFollowingRequests.concat(foundObjects);
		this.showFollowingObjects(foundObjects);
		this._noFollowingResultsDiv.style('display', this._foundFollowingRequests.length === 0 ? null : 'none');
		return true;
	}
	
	function FollowingPanel(user) {
		var header = "Following";
		this.user = user;
		this.createRoot(null, header, "edit following", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Back'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text("Settings");
		
		var _this = this;	
		this.inEditMode = false;
		var editButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (_this.inEditMode)
				{
					showClickFeedback(this, function()
						{
							editButton.selectAll('span').text("Edit");
						});
					if (prepareClick('click', 'Done Edit Following'))
					{
						_this.hideDeleteControls();
						
						_this.inEditMode = false;
						unblockClick();
					}
				}
				else
				{
					if (prepareClick('click', 'Edit Following'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text(crv.buttonTexts.done);
							});
						_this.showDeleteControls();
						_this.inEditMode = true;
						unblockClick();
					}
				}
			});
		editButton.append('span').text("Edit");
		
		navContainer.appendTitle(header);
		
		var panel2Div = this.appendScrollArea();
		
		this._pendingSection = panel2Div.appendSections([user])
				.classed("cell edit multiple", true);

		this._pendingSection.append("label")
			.text("Pending Requests");
		var itemsDiv = this._pendingSection.append("ol");
		this._noPendingResultsDiv = this._pendingSection.append("div")
			.text("None")
			.style("display", "none")
		this._pendingChunker = new GetDataChunker(itemsDiv.node(), 
			function(foundObjects, startVal) { return _this.getPendingRequestsDone(foundObjects, startVal); });
		this._pendingChunker.path = 'user["access request"={0}]'.format(this.user.getInstanceID());
		this._pendingChunker.fields = ["none"];
		
		this.appendActionButton("Ask To Follow", function()
			{
				if (prepareClick('click', 'request follow'))
				{
					showClickFeedback(this);
	
					new RequestFollowPanel(user, _this)
						.showUp()
						.always(unblockClick);
				}
				d3.event.preventDefault();
			});
			
		this._followingSection = panel2Div.appendSections([user])
				.classed("cell edit multiple", true);

		this._followingSection.append("label")
			.text("Following");
		itemsDiv = this._followingSection.append("ol");
		this._noFollowingResultsDiv = this._followingSection.append("div")
			.text("None")
			.style("display", "none")
		this._followingChunker = new GetDataChunker(itemsDiv.node(), 
			function(foundObjects, startVal) { return _this.getFollowingRequestsDone(foundObjects, startVal); });
		this._followingChunker.path = '{0}::reference("access record")[privilege=(read,write,administer)]::reference(user)'.format(this.user.getInstanceID());
		this._followingChunker.fields = ["none"];
		
		$(this.node()).one("revealing.cr", function()
			{
				_this._pendingChunker.start("");			
				_this._followingChunker.start("");
			});	
	}
	
	return FollowingPanel;
})();

