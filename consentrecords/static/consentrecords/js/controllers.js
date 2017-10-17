var Controller = (function() {
	/* The oldInstance is an instance to be replaced. */
	Controller.prototype._oldInstance = null;
	Controller.prototype._newInstance = null;
	
	Controller.prototype.oldInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._oldInstance;
		else
		{
		    if (newValue != this._oldInstance)
		    {
				this._oldInstance = newValue;
				if (this._newInstance)
					this._newInstance.privilege(this._oldInstance.privilege());
			}
			return this;
		}
	}
	
	Controller.prototype.newInstance = function(newValue)
	{
		if (newValue === undefined)
			return this._newInstance;
		else
		{
		    if (newValue != this._newInstance)
		    {
				this._newInstance = newValue;
			}
			return this;
		}
	}
	
	Controller.prototype.setupPrivilege = function()
		{
			console.assert(false); /* Always override */
		}
		
	/* Append all of the data associated with a new instance. */
	Controller.prototype.appendData = function(initialData)
	{
		this.newInstance().appendData(initialData);
	}
	
	Controller.prototype.alertAdd = function()
	{
		return true;
	}
	
	Controller.prototype.save = function()
	{
		var _this = this;
	
		if (this.oldInstance())
		{
			var updateData = this.oldInstance().appendChanges(this.newInstance());
			
			if (Object.keys(updateData).length == 0)
			{
				var r2 = $.Deferred();
				r2.resolve(updateData, {});
				return r2;
			}
							
			var r;
			if (this.oldInstance().id())
			{
				bootstrap_alert.show($('.alert-container'), this.savingMessage, "alert-info");
				r = this.oldInstance().update(updateData, false);
			}
			else
			{
				r = $.Deferred();
				r.resolve(updateData, {});
			}
			return r
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							/* Add any sub elements from the revision to the original. */
							_this.oldInstance().pullElements(_this.newInstance())
									.updateData(changes, newIDs);
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
		else
		{
			/* Test case: add an experience to a path. */
			if (this.alertAdd())
				bootstrap_alert.show($('.alert-container'), this.addingMessage, "alert-info");

			var initialData = {'add': uuid.v4()};

			this.appendData(initialData);
			this.newInstance().clientID(initialData.add);
			return this.postAdd(initialData)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							_this.postAddDone(changes, newIDs);
							$(_this.newInstance()).trigger('added.cr');
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
		}
	}
	
	function Controller(source, duplicateForEdit)
	{
		console.assert(source);
		if (typeof(source) == "object")
		{
			this._newInstance = new source.constructor();
			source.duplicateData(this._newInstance, duplicateForEdit);
		}
		else if (typeof(source) == "function")
		{
			this._newInstance = new source();
			this._newInstance.setDefaultValues();
		}
		this.setupPrivilege();
	}
	
	return Controller;
})();

var RootController = (function() {
	RootController.prototype = Object.create(Controller.prototype);
	RootController.prototype.constructor = RootController;
	
	RootController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege("write");
	}
	
	/** Posts a new instance of this type to the middle tier and returns a promise. */
	RootController.prototype.postAdd = function(initialData)
	{
		console.assert(this.groupKey !== undefined);
		var changes = {};
		changes[this.groupKey] = [initialData];
		return cr.IInstance.updateRoots(changes);
	}
	
	RootController.prototype.postAddDone = function(changes, newIDs)
	{
		this.newInstance().id(newIDs[this.newInstance().clientID()]);
		crp.pushInstance(this.newInstance());
		this.newInstance().updateData(changes[this.groupKey][0], newIDs);
		return this;
	}

	function RootController(source, duplicateForEdit)
	{
		Controller.call(this, source, duplicateForEdit);
	}
	
	return RootController;
})();

var ChildController = (function() {
	ChildController.prototype = Object.create(Controller.prototype);
	ChildController.prototype.constructor = ChildController;
	ChildController.prototype._parent = null;
	
	ChildController.prototype.parent = function(newValue)
	{
		if (newValue === undefined)
			return this._parent;
		else
		{
		    if (newValue != this._parent)
		    {
				this._parent = newValue;
			}
			return this;
		}
	}
	
	ChildController.prototype.setupPrivilege = function()
	{
		this.newInstance().privilege(this._parent.privilege());
	}
	
	ChildController.prototype.alertAdd = function()
	{
		return this.parent().id();
	}
	
	ChildController.prototype.postAdd = function(initialData)
	{
		console.assert(this.groupKey !== undefined);
		var changes = {};
		changes[this.groupKey] = [initialData];
		if (this.parent().id())
		{
			return this.parent().update(changes, false);
		}
		else
		{
			r2 = $.Deferred();
			r2.resolve(changes, {});
			return r2;
		}
	}
	
	ChildController.prototype.postAddDone = function(changes, newIDs)
	{
		this.parent().childAdded(this.newInstance(), 
			changes[this.groupKey][0], newIDs, this.addEventType);
		return this;
	}

	function ChildController(parent, source, duplicateForEdit)
	{
		/* Ensure that addEventType is defined. */
		console.assert(this.addEventType);
		
		this.parent(parent);
		Controller.call(this, source, duplicateForEdit);
		this.newInstance().parent(parent);
	}
	
	return ChildController;
})();

var ServiceLinkController = (function() {
	/* Args can either be a cr.Service or a string. */
	ServiceLinkController.prototype.addService = function(args)
	{
		if (args instanceof cr.Service)
		{
			var i = new (this.serviceLinkType())();
			i.description(args.description())
			 .parent(this.newInstance())
			 .service(args);
			if ('position' in i)
				i.position(this.serviceLinks().length
			           ? parseInt(this.serviceLinks()[this.serviceLinks().length - 1].position()) + 1
			           : 0);
			this.serviceLinks().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	ServiceLinkController.prototype.removeService = function(service)
	{
		cr.removeElement(this.serviceLinks(), service);
	}
	
	/** Returns True if this controller has a service that overrides the importance of
		the first service directly associated with this controller's new instance.
	 */
	ServiceLinkController.prototype.hasPrimaryService = function()
	{
		return false;
	}
	
	ServiceLinkController.prototype.primaryServices = function()
	{
		return [];
	}
	
	ServiceLinkController.prototype.customServiceType = function()
	{
		return null;
	}
	
	function ServiceLinkController()
	{
	}
	
	return ServiceLinkController;
	
})();

var AddressController = (function() {
	AddressController.prototype = Object.create(ChildController.prototype);
	AddressController.prototype.constructor = AddressController;
	
	AddressController.prototype.addingMessage = "Adding Address...";
	AddressController.prototype.savingMessage = "Saving Address...";
	AddressController.prototype.groupKey = 'address';
	AddressController.prototype.addEventType = 'addressAdded.cr';

	function AddressController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Address, duplicateForEdit);
	}
	
	return AddressController;
})();

var CommentPromptController = (function() {
	CommentPromptController.prototype = Object.create(RootController.prototype);
	CommentPromptController.prototype.constructor = CommentPromptController;
	
	CommentPromptController.prototype.addingMessage = "Adding Comment Prompt...";
	CommentPromptController.prototype.savingMessage = "Saving Comment Prompt...";
	CommentPromptController.prototype.groupKey = 'comment prompts';
	
	function CommentPromptController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.CommentPrompt, duplicateForEdit);
	}
	
	return CommentPromptController;
})();

var EngagementController = (function() {
	EngagementController.prototype = Object.create(ChildController.prototype);
	EngagementController.prototype.constructor = EngagementController;
	
	EngagementController.prototype.addingMessage = "Adding Engagement...";
	EngagementController.prototype.savingMessage = "Saving Engagement...";
	EngagementController.prototype.groupKey = 'engagements';
	EngagementController.prototype.addEventType = 'engagementAdded.cr';

	EngagementController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().engagements())
			this.parent().engagements().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function EngagementController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Engagement, duplicateForEdit);
	}
	
	return EngagementController;
})();

var ExperienceController = (function() {
	ExperienceController.prototype = Object.create(ChildController.prototype);
	ExperienceController.prototype.constructor = ExperienceController;
	
	ExperienceController.prototype.addingMessage = "Adding Experience To Your Pathway...";
	ExperienceController.prototype.savingMessage = "Saving Experience...";
	ExperienceController.prototype.groupKey = 'experiences';
	ExperienceController.prototype.addEventType = 'experienceAdded.cr';
	
	ExperienceController.prototype._domain = null;
	ExperienceController.prototype._stage = null;
	ExperienceController.prototype._title = null;
	
	ExperienceController.prototype.domain = function(newValue)
	{
		if (newValue === undefined)
			return this._domain;
		else
		{
		    if (newValue != this._domain)
		    {
				this._domain = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.stage = function(newValue)
	{
		if (newValue === undefined)
			return this._stage;
		else
		{
		    if (newValue != this._stage)
		    {
				this._stage = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.title = function(newValue)
	{
		if (newValue === undefined)
			return this._title;
		else
		{
		    if (newValue != this._title)
		    {
				this._title = newValue;
			}
			return this;
		}
	}
	
	ExperienceController.prototype.organizationName = function()
	{
		return this.newInstance().organizationName();
	}

	ExperienceController.prototype.siteName = function()
	{
		return this.newInstance().siteName();
	}

	ExperienceController.prototype.offeringName = function()
	{
		return this.newInstance().offeringName();
	}

	ExperienceController.prototype.organization = function(newValue)
	{
		var value = this.newInstance().organization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOrganization = function(newValue)
	{
		var value = this.newInstance().customOrganization(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.site = function(newValue)
	{
		var value = this.newInstance().site(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customSite = function(newValue)
	{
		var value = this.newInstance().customSite(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.offering = function(newValue)
	{
		var value = this.newInstance().offering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customOffering = function(newValue)
	{
		var value = this.newInstance().customOffering(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.experienceServices = function(newValue)
	{
		var value = this.newInstance().experienceServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.customServices = function(newValue)
	{
		var value = this.newInstance().customServices(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.start = function(newValue)
	{
		var value = this.newInstance().start(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.end = function(newValue)
	{
		var value = this.newInstance().end(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.timeframe = function(newValue)
	{
		var value = this.newInstance().timeframe(newValue);
		return newValue === undefined ? value : this;
	}

	ExperienceController.prototype.clearOrganization = function()
	{
		this.newInstance().organization(null)
						  .site(null)
						  .customOrganization(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.clearSite = function()
	{
		this.newInstance().site(null)
						  .customSite(null);
		return this;
	}
	
	ExperienceController.prototype.organizationPicked = function(d)
	{
		if (this.site() &&
			this.organization() &&
			this.organization().id() != d.id())
		{
			if (this.offering())
			{
				this.clearOffering();
				this.clearSite();
			}
			else
			{
				this.clearSite();
			}
		}
		
		this.newInstance().organization(d)
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.sitePicked = function(d)
	{
		if (this.offering() &&
			this.site() &&
			this.site().id() != d.id())
			this.clearOffering();
			
		this.newInstance().site(d)
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.offeringPicked = function(d)
	{
		console.assert(d.site());
		console.assert(d.organization());
		
		this.newInstance().offering(d)
						  .customOffering(null)
						  .site(d.site())
						  .customSite(null)
						  .organization(d.organization())
						  .customOrganization(null);
		return this;
	}
	
	ExperienceController.prototype.clearOffering = function()
	{
		this.newInstance().offering(null)
						  .customOffering(null);
		return this;
	}
	
	/* Args can either be a cr.Service or a string. */
	ExperienceController.prototype.addService = function(args)
	{
		if (args instanceof cr.Service)
		{
			var i = new cr.ExperienceService();
			i.description(args.description())
			 .parent(this.newInstance())
			 .service(args)
			 .position(this.experienceServices().length
			           ? parseInt(this.experienceServices()[this.experienceServices().length - 1].position()) + 1
			           : 0);
			this.experienceServices().push(i);
			return i;
		}
		else if (typeof(args) == "string")
		{
			var i = new cr.ExperienceCustomService();
			i.description(args)
			 .parent(this.newInstance())
			 .name(args)
			 .position(this.customServices().length
			           ? parseInt(this.customServices()[this.customServices().length - 1].position()) + 1
			           : 0);
			this.customServices().push(i);
			return i;
		}
		else
			throw new Error("Invalid arguments to addService");
	}
	
	ExperienceController.prototype.removeService = function(service)
	{
		cr.removeElement(this.newInstance().experienceServices(), service);
	}
	
	ExperienceController.prototype.removeCustomService = function(service)
	{
		cr.removeElement(this.newInstance().customServices(), service);
	}
	
	ExperienceController.prototype.distinctExperienceServices = function()
	{
	    return this.newInstance().distinctExperienceServices();
	}
	
	ExperienceController.prototype.getServiceByName = function(name)
	{
		for (i = 0; i < this.experienceServices().length; ++i)
		{
			if (this.experienceServices()[i].description() == name)
				return this.experienceServices()[i].service();
		}
		return null;
	}
	
	ExperienceController.prototype.getTagList = function()
	{
		return this.newInstance().getTagList();
	}
	
	ExperienceController.prototype.appendTags = function(container, tagDivs, addFunction)
	{
		tagDivs = tagDivs !== undefined ? tagDivs : container.selectAll('span');
		addFunction = addFunction !== undefined ? addFunction : function(container, instance)
			{
				container.append('span')
					.datum(instance)
					.classed('tag', true)
					.text(instance.description());
			};
			
		var tags = [];
		
		var offering = this.offering;
		if (offering && offering.id())
		{
			names = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(os) { return os.service(); });
			tags = tags.concat(names);
		}

		tags = tags.concat(this.experienceServices.filter(function(es) 
			{
				var esDescription = es.description();
				return !tags.find(function(d) 
					{ 
						return d.description() === esDescription; 
					})
			})
			.map(function(es) { return es.service(); })
			);
		
		if (this.domain)
			tags.push(this.domain);
		if (this.stage)
			tags.push(this.stage);
			
		tagDivs.filter(function(d) { return d != null && tags.indexOf(d) < 0; } ).remove();
		
		var ds = tagDivs.data();
		for (var i = 0; i < tags.length; ++i)
		{
			if (ds.indexOf(tags[i]) < 0)
			{
				addFunction(container, tags[i]);
			}
		}
	}
	
	ExperienceController.prototype.postAddDone = function(changes, newIDs)
	{
		/* Remove from the experience any experiences that are
			duplicated in the offering services */
		this.newInstance().experienceServices(this.distinctExperienceServices());
		this.newInstance().path(this.parent());
		
		if (this.parent().experiences())
			this.parent().experiences().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	ExperienceController.prototype.initPreviousDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear() - 1, getMonthString(todayDate)));
		this.newInstance().end("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
		return this;
	}
	
	ExperienceController.prototype.initCurrentDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("{0}-{1}".format(todayDate.getUTCFullYear(), getMonthString(todayDate)));
		this.newInstance().end("");
		return this;
	}
	
	ExperienceController.prototype.initGoalDateRange = function()
	{
		var todayDate = getUTCTodayDate();
		this.newInstance().start("");
		this.newInstance().end("");
		return this;
	}
	
	ExperienceController.prototype.initDateRange = function(phase)
	{
		if (phase === 'Goal')
			this.initGoalDateRange();
		else if (phase === 'Current')
			this.initCurrentDateRange();
		else
		{
			phase = 'Previous';
			this.initPreviousDateRange();
		}
		this.timeframe(phase);
		return this;
	}
	
	ExperienceController.prototype.service = function(service)
	{
		this.addService(service);
		return this;
	}
	
	ExperienceController.prototype.createFromSite = function(d, services)
	{
		this.initPreviousDateRange();
		
		this.organization(d.organization())
			.customOrganization(null)
			.site(d)
			.customSite(null);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}

	ExperienceController.prototype.createFromOffering = function(d, services)
	{
		if (!d.organization())
			throw new Error("Runtime Error: Organization is not present in offering record.")
		if (!d.site())
			throw new Error("Runtime Error: Site is not present in offering record.")

		this.initPreviousDateRange();
		
		this.offeringPicked(d);
		
		var _this = this;
		m = services.map(function(serviceD) { return _this.addService(serviceD); });
	}
	
	ExperienceController.prototype.createFromService = function(d)
	{
		this.initPreviousDateRange();
		
		var service = this.addService(d);
	}
	
	ExperienceController.prototype.getOfferingConstraint = function()
	{
		if (this.experienceServices().length > 0 &&
			this.experienceServices()[0])
			return '[service>service={0}]'.format(this.experienceServices()[0].service().id());
		else if (this.domain())
			return '[service>service={0}]'.format(this.domain().id());
		else if (this.stage())
			return '[service>service[stage={0}]]'.format(this.stage());
		else
			return "";
	}
	
	/** Returns True if this controller has a service that overrides the importance of
		the first service directly associated with this controller's new instance.
	 */
	ExperienceController.prototype.hasPrimaryService = function()
	{
		return this.offering() &&
			   this.offering().offeringServices().length > 0;
	}
	
	ExperienceController.prototype.primaryServices = function()
	{
		var offering = this.offering();
		if (offering && offering.id())
		{
			return offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(s) { return s.service(); });
		}
		else
			return [];
	}
	
	ExperienceController.prototype.serviceLinks = function()
	{
		return this.experienceServices();
	}
	
	ExperienceController.prototype.serviceLinkType = function()
	{
		return cr.ExperienceService;
	}
	
	ExperienceController.prototype.customServiceType = function()
	{
		return cr.ExperienceCustomService;
	}
	
	function ExperienceController(path, source, duplicateForEdit)
	{
		console.assert(path instanceof cr.Path);
			
		ChildController.call(this, path, source || cr.Experience, duplicateForEdit);
	}
	
	return ExperienceController;
})();

var ExperiencePromptServicesController = (function() {
	ExperiencePromptServicesController.prototype = Object.create(ServiceLinkController.prototype);
	ExperiencePromptServicesController.prototype.constructor = ExperiencePromptServicesController;
	
	ExperiencePromptServicesController.prototype.newInstance = function()
	{
		return this.parent;
	}
	
	ExperiencePromptServicesController.prototype.serviceLinks = function()
	{
		return this.parent.experiencePromptServices();
	}
	
	ExperiencePromptServicesController.prototype.serviceLinkType = function()
	{
		return cr.ExperiencePromptService;
	}
	
	function ExperiencePromptServicesController(parent)
	{
		this.parent = parent;
	}
	
	return ExperiencePromptServicesController;
})();

var DisqualifyingTagsController = (function() {
	DisqualifyingTagsController.prototype = Object.create(ServiceLinkController.prototype);
	DisqualifyingTagsController.prototype.constructor = DisqualifyingTagsController;
	
	DisqualifyingTagsController.prototype.newInstance = function()
	{
		return this.parent;
	}
	
	DisqualifyingTagsController.prototype.serviceLinks = function()
	{
		return this.parent.disqualifyingTags();
	}
	
	DisqualifyingTagsController.prototype.serviceLinkType = function()
	{
		return cr.DisqualifyingTag;
	}
	
	function DisqualifyingTagsController(parent)
	{
		this.parent = parent;
	}
	
	return DisqualifyingTagsController;
})();

var ExperiencePromptController = (function() {
	ExperiencePromptController.prototype = Object.create(RootController.prototype);
	ExperiencePromptController.prototype.constructor = ExperiencePromptController;
	
	ExperiencePromptController.prototype.addingMessage = "Adding Experience Prompt...";
	ExperiencePromptController.prototype.savingMessage = "Saving Experience Prompt...";
	ExperiencePromptController.prototype.groupKey = 'experience prompts';
	
	function ExperiencePromptController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.ExperiencePrompt, duplicateForEdit);
	}
	
	return ExperiencePromptController;
})();

var GroupController = (function() {
	GroupController.prototype = Object.create(ChildController.prototype);
	GroupController.prototype.constructor = GroupController;
	
	GroupController.prototype.addingMessage = "Adding Group...";
	GroupController.prototype.savingMessage = "Saving Group...";
	GroupController.prototype.groupKey = 'groups';
	GroupController.prototype.addEventType = 'groupAdded.cr';

	GroupController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().groups())
			this.parent().groups().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function GroupController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Group, duplicateForEdit);
	}
	
	return GroupController;
})();

var OfferingController = (function() {
	OfferingController.prototype = Object.create(ChildController.prototype);
	Object.assign(OfferingController.prototype, ServiceLinkController.prototype);
	OfferingController.prototype.constructor = OfferingController;
	
	OfferingController.prototype.addingMessage = "Adding Offering...";
	OfferingController.prototype.savingMessage = "Saving Offering...";
	OfferingController.prototype.groupKey = 'offerings';
	OfferingController.prototype.addEventType = 'offeringAdded.cr';

	OfferingController.prototype.serviceLinks = function()
	{
		return this.newInstance().offeringServices();
	}
	
	OfferingController.prototype.serviceLinkType = function()
	{
		return cr.OfferingService;
	}
	
	OfferingController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().offerings())
			this.parent().offerings().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function OfferingController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Offering, duplicateForEdit);
	}
	
	return OfferingController;
})();

var OrganizationController = (function() {
	OrganizationController.prototype = Object.create(RootController.prototype);
	OrganizationController.prototype.constructor = OrganizationController;
	
	OrganizationController.prototype.addingMessage = "Adding Organization...";
	OrganizationController.prototype.savingMessage = "Saving Organization...";
	OrganizationController.prototype.groupKey = 'organizations';
	
	OrganizationController.prototype.webSite = function(newValue)
	{
		var value = this.newInstance().webSite(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.inquiryAccessGroup = function(newValue)
	{
		var value = this.newInstance().inquiryAccessGroup(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.names = function(newValue)
	{
		var value = this.newInstance().names(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.groups = function(newValue)
	{
		var value = this.newInstance().groups(newValue);
		return newValue === undefined ? value : this;
	}

	OrganizationController.prototype.sites = function(newValue)
	{
		var value = this.newInstance().sites(newValue);
		return newValue === undefined ? value : this;
	}

	function OrganizationController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.Organization, duplicateForEdit);
	}
	
	return OrganizationController;
})();

var PeriodController = (function() {
	PeriodController.prototype = Object.create(ChildController.prototype);
	PeriodController.prototype.constructor = PeriodController;
	
	PeriodController.prototype.addingMessage = "Adding Period...";
	PeriodController.prototype.savingMessage = "Saving Period...";
	PeriodController.prototype.groupKey = 'periods';
	PeriodController.prototype.addEventType = 'periodAdded.cr';

	PeriodController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().periods())
			this.parent().periods().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function PeriodController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Period, duplicateForEdit);
	}
	
	return PeriodController;
})();

var ServiceController = (function() {
	ServiceController.prototype = Object.create(RootController.prototype);
	Object.assign(ServiceController.prototype, ServiceLinkController.prototype);
	ServiceController.prototype.constructor = ServiceController;
	
	ServiceController.prototype.addingMessage = "Adding Service...";
	ServiceController.prototype.savingMessage = "Saving Service...";
	ServiceController.prototype.groupKey = 'services';
	
	ServiceController.prototype.serviceLinks = function()
	{
		return this.newInstance().serviceImplications();
	}
	
	ServiceController.prototype.serviceLinkType = function()
	{
		return cr.ServiceImplication;
	}
	
	function ServiceController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.Service, duplicateForEdit);
	}
	
	return ServiceController;
})();

var SessionController = (function() {
	SessionController.prototype = Object.create(ChildController.prototype);
	SessionController.prototype.constructor = SessionController;
	
	SessionController.prototype.addingMessage = "Adding Session...";
	SessionController.prototype.savingMessage = "Saving Session...";
	SessionController.prototype.groupKey = 'sessions';
	SessionController.prototype.addEventType = 'sessionAdded.cr';

	SessionController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().sessions())
			this.parent().sessions().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function SessionController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Session, duplicateForEdit);
	}
	
	return SessionController;
})();

var SiteController = (function() {
	SiteController.prototype = Object.create(ChildController.prototype);
	SiteController.prototype.constructor = SiteController;
	
	SiteController.prototype.addingMessage = "Adding Site...";
	SiteController.prototype.savingMessage = "Saving Site...";
	SiteController.prototype.groupKey = 'sites';
	SiteController.prototype.addEventType = 'siteAdded.cr';

	SiteController.prototype.postAddDone = function(changes, newIDs)
	{
		if (this.parent().sites())
			this.parent().sites().push(this.newInstance());
		return ChildController.prototype.postAddDone.call(this, changes, newIDs);
	}

	function SiteController(parent, source, duplicateForEdit)
	{
		ChildController.call(this, parent, source || cr.Site, duplicateForEdit);
	}
	
	return SiteController;
})();

var UserController = (function() {
	UserController.prototype = Object.create(RootController.prototype);
	UserController.prototype.constructor = UserController;
	
	UserController.prototype.addingMessage = "Adding User...";
	UserController.prototype.savingMessage = "Saving User...";
	UserController.prototype.groupKey = 'users';
	
	function UserController(source, duplicateForEdit)
	{
		RootController.call(this, source || cr.User, duplicateForEdit);
	}
	
	return UserController;
})();

