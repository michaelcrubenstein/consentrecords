var RequestFollowSearchView = (function () {
	RequestFollowSearchView.prototype = new PanelSearchView();
	
	/* Overrides SearchView.prototype.onClickButton */
	RequestFollowSearchView.prototype.onClickButton = function(d, i) {
	}

	RequestFollowSearchView.prototype.showObjects = function(foundObjects)
	{
		var buttons = SearchView.prototype.showObjects.call(this, foundObjects);
		
		var _this = this;
		buttons.on("click", function(d, i)
			{
				if (prepareClick('click', 'request to follow user', false))
				{
					var _thisButton = this;
					var done = function()
					{
						bootstrap_alert.success("Access to {0} has been requested.".format(d.getDescription()),
																		  ".alert-container");
						_this.sitePanel.followingPanel.showPendingObjects([d]);
						_this.sitePanel.followingPanel._pendingSection.selectAll('li').sort(
							function(a, b)
							{
								return a.getDescription().localeCompare(b.getDescription());
							}
						);
						_this.sitePanel.followingPanel._noPendingResultsDiv.style('display', 'none');

						$(_thisButton.parentNode).animate({height: "0px"}, 400, 'swing', function()
						{
							$(this).remove();
							unblockClick();
						});
					}
					cr.addObjectValue("#"+d.getValueID(), "_access request", _this.user, done, syncFailFunction);
				}
				d3.event.preventDefault();
			});
			
		return buttons;
	}
	
	
	/* Overrides SearchView.searchPath */
	RequestFollowSearchView.prototype.searchPath = function(val)
	{
		var s = '_user::not(#{0})::not(#{0}::reference("_access record")[_privilege=(_read,_write,_administer)]::reference(_user))'.format(this.user.getValueID());
		s += '::not(_user["_access request"={0}])'.format(this.user.getValueID());
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[_email^="' + val + '"]';
		else
			return s + '[_email*="' + val + '"]';
	}
	
	/* Overrides SearchView.prototype.isButtonVisible */
	RequestFollowSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		if (compareText.length === 0)
			return true;
			
		return d.getDescription().toLocaleLowerCase().indexOf(compareText) >= 0;
	}
	
	function RequestFollowSearchView(sitePanel, user)
	{
		this.user = user;
		PanelSearchView.call(this, sitePanel, "Email", undefined, SelectAllChunker);
	}
	
	return RequestFollowSearchView;
})();
	
var RequestFollowPanel = (function() {
	RequestFollowPanel.prototype = new SitePanel();
	RequestFollowPanel.prototype.followingPanel = null;
	
	function RequestFollowPanel(user, followingPanel) {
		var header = "Ask to Follow";
		this.followingPanel = followingPanel;
		SitePanel.call(this, followingPanel.node(), null, header, "list", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		navContainer.appendLeftButton()
			.on("click", handleCloseRightEvent)
		    .append("span").text("Done");
		
		var _this = this;	

		navContainer.appendTitle(header);

		this.searchView = new RequestFollowSearchView(this, user);

		showPanelUp(this.node(), unblockClick);
	}
	
	return RequestFollowPanel;
})();

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
					cr.getValues({path: '#{0}'.format(d.getValueID()),
						field: "_access request",
						value: _this.user.getValueID(),
						done: function(values)
						{
							if (values.length > 0)
							{
								values[0].deleteValue(
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
									syncFailFunction);
							}
						},
						fail: syncFailFunction});
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
	
	function FollowingPanel(user, previousPanel) {
		var header = "Following";
		this.user = user;
		SitePanel.call(this, previousPanel, null, header, "edit following", revealPanelUp);
		var navContainer = this.appendNavContainer();
		
		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Following Done'))
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
					if (prepareClick('click', 'Done Editing'))
					{
						_this.hideDeleteControls();
						
						_this.inEditMode = false;
						unblockClick();
					}
				}
				else
				{
					if (prepareClick('click', 'Start Editing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text("Done");
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
		this._pendingChunker = new SelectAllChunker(itemsDiv.node(), 
			function(foundObjects, startVal) { return _this.getPendingRequestsDone(foundObjects, startVal); });
		this._pendingChunker.path = '_user["_access request"={0}]'.format(this.user.getValueID());
		this._pendingChunker.fields = [];
		
		this.appendActionButton("Ask To Follow", function()
			{
				if (prepareClick('click', 'request follow'))
				{
					showClickFeedback(this);
	
					var newPanel = new RequestFollowPanel(user, _this);
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
		this._followingChunker = new SelectAllChunker(itemsDiv.node(), 
			function(foundObjects, startVal) { return _this.getFollowingRequestsDone(foundObjects, startVal); });
		this._followingChunker.path = '#{0}::reference("_access record")[_privilege=_read,_write,_administer]::reference(_user)'.format(this.user.getValueID());
		this._followingChunker.fields = [];
		
		$(this.node()).one("revealing.cr", function()
			{
				_this._pendingChunker.start("");			
				_this._followingChunker.start("");
			});	
	}
	
	return FollowingPanel;
})();

