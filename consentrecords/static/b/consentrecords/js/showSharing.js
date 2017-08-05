var SharingPanel = (function() {
	SharingPanel.prototype = new SitePanel();
	SharingPanel.prototype.privilegesByID = null;
	SharingPanel.prototype.privileges = null;
	SharingPanel.prototype.user = null;
	
	/* readPrivilegeIndex is the index into the privileges array that identifies
		read privileges. */
	SharingPanel.prototype.readPrivilegeIndex = 0;
	
	/*** Appends the controls for each item that shows a user or group that has a specified privilege.
	 */
	SharingPanel.prototype.appendUserControls = function(items)
	{
		crf.appendDeleteControls(items);

		items.append("div")
			.classed("description-text growable unselectable", true)
			.text(_getDataDescription)
			.each(_pushTextChanged);

		appendInfoButtons(items, function(d) { return d.grantee(); });

		crf.appendConfirmDeleteControls(items);
		this.checkDeleteControlVisibility(items);
		
		return items;
	}

	SharingPanel.prototype.checkDeleteControlVisibility = function(items)
	{
		items.each(function(d, i)
			{
				var deleteControls = $(this).parent().find('button.delete');
				if (!this.inEditMode)
					crf.hideDeleteControls(deleteControls, 0);
				else
					crf.showDeleteControls(deleteControls, 0);
			});
	}
	
	/* Produces a function which adds new value view to a container view
		when the new data is added.
		the viewFunction is called when the item is clicked.
	 */
	SharingPanel.prototype.onGrantAdded = function(itemsDivNode, newValue)
	{
		var itemsDiv = d3.select(itemsDivNode);
		var item = appendItem(itemsDiv, newValue);
		
		this.appendUserControls(item);

		item.style("display", null);
		var newHeight = item.style("height");
		item.style("height", "0");
		$(item.node()).animate({height: newHeight}, 400, "swing");
	}

	SharingPanel.prototype.appendApplyButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Accept");
			
		var _this = this;
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'accept access request {0}'.format(d.description())))
				{
					try
					{
						var accessorLevel = _this.privileges[_this.readPrivilegeIndex];
					
						_this.addAccessRecord(accessorLevel, d.grantee().urlPath())
							.then(function()
								{
									/* Since this item was deleted as part of adding access,  
										process it's deletion. */
									$(d).trigger("deleted.cr", d);
									unblockClick();
								}, 
								cr.syncFail);
					}
					catch (err)
					{
						cr.syncFail(err);
					}
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.appendIgnoreButtons = function(buttons)
	{
		var spans = buttons.append('span').classed('site-active-text', true)
			.text("Ignore");
			
		spans.on('click', function(d) {
				if (prepareClick('click', 'ignore access request {0}'.format(d.description())))
				{
					d.deleteData()
						.then(function()
						{
							unblockClick();
						},
						cr.syncFail);
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.loadAccessRecords = function(panel2Div, user)
	{
		var _this = this;
		var sections, itemCells, items;
		var accessRequestSection, accessRequestList;
		
		accessRequestSection = panel2Div.append("section")
			.datum(this.user)
			.classed("cell multiple edit", true);
		accessRequestSection.append("label")
			.text("Access Requests");
		accessRequestList = crf.appendItemList(accessRequestSection);
			
		items = appendItems(accessRequestList, user.userGrantRequests(),
			function()
			{
				accessRequestSection.style('display', accessRequestList.selectAll('li').size() ? '' : 'none');
			});
		accessRequestSection.style('display', items.size() ? '' : 'none');
		
		var leftDivs = items.append('div')
			.classed('growable', true);
			
		var texts = appendButtonDescriptions(leftDivs)
			.each(_pushTextChanged);
		var infoButtonDivs = appendInfoButtons(items, function(d) { return d.grantee(); });
		
		var itemButtonDivs = leftDivs.append('div');
		this.appendApplyButtons(itemButtonDivs);
		this.appendIgnoreButtons(itemButtonDivs);
			
		// Sort the access records by type.
		var grants = user.userGrants().concat(user.groupGrants());
		for (var i = 0; i < grants.length; ++i)
		{
			var a = grants[i];
			var privilege = a.privilege();
			if (privilege in this.privilegesByID)
			{
				var sa = this.privilegesByID[privilege];
				sa.accessRecords.push(a);
				sa.accessors.push(a);
			}
		}
	
		var key = 0;
		sections = panel2Div.selectAll("section")
			.data(this.privileges, function(d) {
				/* Ensure that this operation appends without replacing any items. */
				key += 1;
				return key;
			  })
			.enter()
			.append("section")
			.classed("cell multiple edit", true);
		sections.append("label")
			.text(function(d) { return d.label });
			
		itemCells = crf.appendItemList(sections)
			.classed("deletable-items", true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		items = appendItems(itemCells, function(d) { return d.accessors });
		
		this.appendUserControls(items);
		
		/* Add one more button for the add Button item. */
		sections
			.append("button").classed("btn row-button add-item site-active-text", true)
			.on("click", function(d) {
				_this.addAccessor(_this.user, d, $(this).parents(".cell").children(".cell-items")[0]);
			})
			.append("div").text("Add User or Group");
		
	}

	SharingPanel.prototype.getPrivileges = function(panel2Div)
	{
		var _this = this;
		for (var j = 0; j < this.privileges.length; ++j)
		{
			var p = this.privileges[j];
			this.privilegesByID[p.name] = p;
		}
		this.loadAccessRecords(panel2Div, this.user);
	}
	
	SharingPanel.prototype.addAccessRecord = function(accessorLevel, path)
	{
		var _this = this;

		return this.user.postUserGrant(accessorLevel.name, path)
			.then(function(changes, newIDs)
				{
					return cr.getData({path: 'user grant/' + newIDs['1'], resultType: cr.UserGrant, fields: ['none']})
				})
			.then(function(userGrants)
				{
					var userGrant = userGrants[0];
					_this.onGrantAdded(accessorLevel.itemsDiv, userGrant);
					var r2 = $.Deferred();
					r2.resolve(userGrant);
					return r2;
				});
	}
	
	/*
		Responds to a request to add a user or group to the access records of the specified user.
	 */
	SharingPanel.prototype.addAccessor = function(user, accessorLevel, itemsDiv)
	{
		var _this = this;
		
		if (prepareClick('click', 'add accessor: ' + accessorLevel.name))
		{
			function onPick(path)
			{
				_this.addAccessRecord(accessorLevel, path)
					.then(function()
						{
							panel.hideRight(unblockClick);
						}, cr.syncFail);
			}
			var panel = new PickSharingUserPanel("Add User Or Group", onPick);
		}
	}

	function SharingPanel(user, backButtonText, showFunction)
	{
		showFunction = (showFunction !== undefined) ? showFunction : revealPanelUp;
		this.createRoot(null, "Sharing", "edit sharing", showFunction);
		this.user = user;
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'Sharing Done'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		appendLeftChevrons(backButton).classed("site-active-text", true);
		backButton.append("span").text(backButtonText);
		
		this.inEditMode = false;
		var editButton = navContainer.appendRightButton()
			.on("click", function()
			{
				var dials = $(_this.node()).find('ol.deletable-items>li>button:first-of-type');
				if (_this.inEditMode)
				{
					if (prepareClick('click', 'Done Edit Sharing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text(crv.buttonTexts.edit);
							});
						crf.hideDeleteControls(dials);
						_this.inEditMode = false;
						unblockClick();
					}
				}
				else
				{
					if (prepareClick('click', 'Edit Sharing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text(crv.buttonTexts.done);
							});
						crf.showDeleteControls(dials);
						_this.inEditMode = true;
						unblockClick();
					}
				}
			});
		editButton.append('span').text(crv.buttonTexts.edit);
		
		navContainer.appendTitle('Sharing');
		
		var panel2Div = this.appendScrollArea();

		this.privilegesByID =  {};
		this.privileges =  [
			{name: cr.privileges.read, id: "", accessRecords: [], accessors: [], label: "Who Can See Your Profile"},
			{name: cr.privileges.administer, id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}];
	
		this.getPrivileges(panel2Div);
	}
	
	return SharingPanel;
})();

/*
	Displays a panel from which the user can choose a user or group.
	
	This function should be called within a prepareClick block. 
 */
var PickSharingUserPanel = (function() {
	PickSharingUserPanel.prototype = new SitePanel();
	PickSharingUserPanel.prototype.title = "User Or Group"
	PickSharingUserPanel.prototype.badEmailMessage =
		'Please specify a valid email address.';
	PickSharingUserPanel.prototype.emailDocumentation = 
		'Type the email address of someone you want to give access to your profile.';
	
	function PickSharingUserPanel(header, done)
	{
		var _this = this;
		this.createRoot(null, this.title, "list");

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
				if (prepareClick('click', 'Add'))
				{
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
							done('user[email>text="{0}"]'.format(email), _this);
						}
					}
					catch(err)
					{
						syncFailFunction(err);
					}
				}
				d3.event.preventDefault();
			})
		    .append("span").text("Add");
		
		navContainer.appendTitle(this.title);

		var panel2Div = this.appendScrollArea();

		var sectionPanel = panel2Div.append('section')
			.classed('cell edit unique', true);
			
		var itemsDiv = crf.appendItemList(sectionPanel);

		var items = itemsDiv.append("li");	// So that each item appears on its own row.
			
		var emailInput = items.append("input")
			.classed('growable', true)
			.attr("type", "email")
			.attr("placeholder", 'Email');
			
		var docSection = panel2Div.append('section')
			.classed('cell documentation', true);
			
		var docDiv = docSection.append('div')
			.text(this.emailDocumentation);
			
		this.showLeft().then(unblockClick);
	}
	
	return PickSharingUserPanel;
})();

