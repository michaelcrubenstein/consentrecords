var SharingPanel = (function() {
	SharingPanel.prototype = new SitePanel();
	SharingPanel.prototype.privilegesByID = null;
	SharingPanel.prototype.privileges = null;
	SharingPanel.prototype.user = null;
	
	/* readPrivilegeIndex is the index into the privileges array that identifies
		read privileges. */
	SharingPanel.prototype.readPrivilegeIndex = 0;
	
	SharingPanel.prototype.appendUserControls = function(items)
	{
		appendConfirmDeleteControls(items);
	
		var buttons = appendRowButtons(items);

		var deleteControls = this.appendDeleteControls(buttons);
	
		appendInfoButtons(buttons, this.node());

		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
		if (!this.inEditMode)
			this.hideDeleteControlsNow($(deleteControls[0]));
		else
			this.showDeleteControls($(deleteControls[0]), 0);
		
		return buttons;
	}

	/* Produces a function which adds new value view to a container view
		when the new data is added.
		the viewFunction is called when the item is clicked.
	 */
	SharingPanel.prototype.onUserAdded = function(itemsDivNode, newValue)
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
				if (prepareClick('click', 'accept access request {0}'.format(d.getDescription())))
				{
					try
					{
						var accessorLevel = _this.privileges[_this.readPrivilegeIndex];
						function done()
						{
							/* Since this item was deleted as part of adding access,  
								trigger a deleteValue event. */
							d.triggerDeleteValue();
							unblockClick();
						};
					
						_this.addAccess(accessorLevel, "#{0}".format(d.getInstanceID()), done);
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
				if (prepareClick('click', 'ignore access request {0}'.format(d.getDescription())))
				{
					d.deleteValue(function()
						{
							unblockClick();
						},
						syncFailFunction);
				}
			});
			
		return buttons;
	}
	
	SharingPanel.prototype.loadAccessRecords = function(panel2Div, accessRecords)
	{
		var _this = this;
		var sections, itemCells, items;
		var accessRequestSection, accessRequestList;
		
		accessRequestSection = panel2Div.append("section")
			.datum(this.user.getCell("_access request"))
			.classed("cell multiple edit", true);
		accessRequestSection.append("label")
			.text("Access Requests");
		accessRequestList = accessRequestSection.append("ol")
			.classed("cell-items", true);
			
		items = appendItems(accessRequestList, accessRequestSection.datum().data,
			function()
			{
				accessRequestSection.style('display', accessRequestList.selectAll('li').size() ? "" : "none");
			});
		accessRequestSection.style('display', items.size() ? "" : "none");
		
		var buttons = items.append("div").classed("btn row-button multi-row-content", true);
		var infoButtons = appendInfoButtons(buttons, this.node());
		
		appendButtonDescriptions(buttons)
			.each(_pushTextChanged);
		var itemButtonDivs = buttons.append('div');
		var applyButtons = this.appendApplyButtons(itemButtonDivs);
		var ignoreButtons = this.appendIgnoreButtons(itemButtonDivs);
			
		// Sort the access records by type.
		for (var i = 0; i < accessRecords.length; ++i)
		{
			var a = accessRecords[i];
			var cell = a.getCell("_privilege");
			if (cell && cell.data.length > 0)
			{
				var d = cell.data[0];
				if (d.getInstanceID() in this.privilegesByID)
				{
					var sa = this.privilegesByID[d.getInstanceID()];
					sa.accessRecords.push(a);
					var userCell = a.getCell("_user");
					var groupCell = a.getCell("_group");
					for (var j = 0; j < userCell.data.length; ++j)
					{
						sa.accessors.push(userCell.data[j]);
					}
					for (var j = 0; j < groupCell.data.length; ++j)
					{
						sa.accessors.push(groupCell.data[j]);
					}
				}
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
			
		itemCells = sections.append("ol")
			.classed("cell-items", true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		items = appendItems(itemCells, function(d) { return d.accessors });
		
		this.appendUserControls(items);
		
		/* Add one more button for the add Button item. */
		var buttonDiv = sections.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(d) {
				_this.addAccessor(_this.user, d, $(this).parents(".cell").children(".cell-items")[0]);
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").text("Add User or Group");
	}

	SharingPanel.prototype.getPrivileges = function(panel2Div, enumerators)
	{
		var _this = this;
		for (var i = 0; i < enumerators.length; ++i)
		{
			var e = enumerators[i];
			for (var j = 0; j < this.privileges.length; ++j)
			{
				var p = this.privileges[j];
				if (p.name == e.getDescription())
				{
					p.id = e.getInstanceID();
					this.privilegesByID[p.id] = p;
					break;
				}
			}
		}
		cr.getData({path: "#" + this.user.getInstanceID() + '>"_access record"', 
					fields: ["parents"], 
					done: function(accessRecords) { _this.loadAccessRecords(panel2Div, accessRecords); }, 
					fail: asyncFailFunction});
	}
	
	SharingPanel.prototype.addAccessRecord = function(accessorLevel, path, done)
	{
		var _this = this;

		var userPath = "#{0}".format(this.user.getInstanceID());
		cr.share(userPath, path, accessorLevel.id, function(newData)
			{
				var accessRecordCell = _this.user.getCell("_access record");
				accessRecordCell.addValue(newData);
				accessorLevel.accessRecords.push(newData);
				newData.promiseCells(undefined)
					.then(function()
					{
						try
						{
							var newValue = newData.getValue('_user') || newData.getValue('_group');
							_this.onUserAdded(accessorLevel.itemsDiv, newValue);
							done();
						}
						catch(err)
						{
							syncFailFunction(err);
						}
					}, syncFailFunction);
			}, syncFailFunction);
	}
	
	SharingPanel.prototype.addAccessUser = function(accessorLevel, path, done)
	{
		var _this = this;

		var ar = accessorLevel.accessRecords[0]
		var userPath = "#{0}".format(this.user.getInstanceID());
		ar.promiseCells()
			.then(function()
				{
					cr.share(userPath, path, accessorLevel.id, function(newValue)
						{
							var cellName = newValue.getTypeName() == '_user' ? '_user' : '_group';
							var cell = ar.getCell(cellName);
							cell.addValue(newValue);
							_this.onUserAdded(accessorLevel.itemsDiv, newValue);
							done();
						}, cr.syncFail);
				}, 
				cr.syncFail);
	}
	
	SharingPanel.prototype.addAccess = function(accessorLevel, path, done)
	{
		var _this = this;
		if (accessorLevel.accessRecords.length == 0)
		{
			// Create an instance of an access record with this accessor level
			// and this user.
			this.addAccessRecord(accessorLevel, path, done);
		}
		else
		{
			// Add this user to the access record associated with this accessor level.
			this.addAccessUser(accessorLevel, path, done);
		}
	}

	/*
		Responds to a request to add a user or group to the access records of the specified user.
	 */
	SharingPanel.prototype.addAccessor = function(user, accessorLevel, itemsDiv)
	{
		var _this = this;
		
		if (prepareClick('click', 'add accessor: ' + accessorLevel.name))
		{
			var accessRecordCell = user.getCell("_access record");
			function onPick(path)
			{
				function done()
				{
					panel.hideRight(unblockClick);
				}
				
				_this.addAccess(accessorLevel, path, done);
			}
			var panel = new PickSharingUserPanel("Add User Or Group", onPick);
		}
	}

	function SharingPanel(user)
	{
		this.createRoot(null, "Sharing", "edit sharing", revealPanelUp);
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
		backButton.append("span").text("Settings");
		
		this.inEditMode = false;
		var editButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (_this.inEditMode)
				{
					if (prepareClick('click', 'Done Edit Sharing'))
					{
						showClickFeedback(this, function()
							{
								editButton.selectAll('span').text("Edit");
							});
						_this.hideDeleteControls();
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
								editButton.selectAll('span').text("Done");
							});
						_this.showDeleteControls();
						_this.inEditMode = true;
						unblockClick();
					}
				}
			});
		editButton.append('span').text("Edit");
		
		navContainer.appendTitle('Sharing');
		
		var panel2Div = this.appendScrollArea();

		this.privilegesByID =  {};
		this.privileges =  [
			{name: "_read", id: "", accessRecords: [], accessors: [], label: "Who Can See Your Profile"},
			{name: "_administer", id: "", accessRecords: [], accessors: [], label: "Who Can Manage Your Account"}];
	
		var privilegePath = "_term[_name=_privilege]>enumerator";
		crp.promise({path: privilegePath})
			.done(function(enumerators) { _this.getPrivileges(panel2Div, enumerators); })
			.fail(cr.asyncFail);
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
							done('_user[_email="{0}"]'.format(email), _this);
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
			
		this.showLeft().then(unblockClick);
	}
	
	return PickSharingUserPanel;
})();

