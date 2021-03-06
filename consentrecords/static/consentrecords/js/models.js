var CRP = (function() {
	CRP.prototype.instances = {};	/* keys are ids, values are objects. */
	CRP.prototype.promises = {};	/* keys are paths, values are promises */
	
    function CRP() {
    	this.clear();
    };
    
    CRP.prototype.clear = function() {
    	this.instances = {};
    	this.promises = {};
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	console.assert(id);
    	console.assert(typeof(id) == 'string');
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushInstance = function(i)
	{
		if (i.id())
		{
			if (!(i.id() in this.instances))
			{
				this.instances[i.id()] = i;
				return i;
			}
			else
			{
				var oldInstance = this.instances[i.id()];
				return oldInstance.mergeData(i);
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	/*
		args has the following fields: path, fields
	 */
	CRP.prototype.promise = function(args)
	{
		if (args.path in this.promises)
			return this.promises[args.path];

		var _this = this;
		
		var promise = cr.getData(args)
			.fail(function(err)
				{
					_this.promises[args.path] = undefined;
					var result = $.Deferred();
					result.reject(err);
					return result.promise();
				});
		this.promises[args.path] = promise;
		return promise;
	}
	
	return CRP;
})();

var crp = new CRP();

cr.privileges = {
	find: "find",
	read: "read",
	write: "write",
	administer: "administer",
	register: "register"
}

cr.booleans = {
	yes: "yes",
	no: "no"
}

cr.assertArrayType = function(a, type)
{
	for (var i = 0; i < a.length; ++i)
		console.assert(a[i] instanceof type);
}

cr.ModelObject = (function()
{
	ModelObject.prototype.on = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).on(events, data, handler);
	}

	ModelObject.prototype.one = function(events, data, handler)
	{
		if (typeof(events) != "string")
			throw new Error("events is not a string");
		if (typeof(data) != "object")
			throw new Error("data is not an object");
		if (typeof(handler) != "function")
			throw new Error("handler is not a function");
		$(this).one(events, data, handler);
	}

	ModelObject.prototype.off = function(events, handler)
	{
		$(this).off(events, handler);
	}

	ModelObject.prototype.triggerDataChanged = function(changedValue)
	{
		changedValue = changedValue !== undefined ? changedValue : this;
		$(this).trigger("dataChanged.cr", changedValue);
	}
	
	function ModelObject() {
	};
	
	return ModelObject;
})();
	
cr.getUserID = function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getUserID,
			{"access_token": cr.accessToken})
		.done(function(json)
			{
				successFunction(json.userID);
			})
		.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			}
		);
	},

/* 
	args is an object with up to four parameters: path, fields, done, fail
 */
cr.getData = function(args)
	{
		if (!args.path)
			throw new Error("path is not specified to getData");
		if (!args.resultType)
		    throw new Error("resultType is not specified to getData");
		
		var data = {};
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.start !== undefined)
			data.start = args.start;
		if (args.end !== undefined)
			data.end = args.end;
		
		return $.getJSON(cr.urls.getData + args.path + "/", data)
			.then(function(json)
				{
					try
					{
						return json.data.map(function(d)
							{
								var i = new args.resultType();
								i.setData(d);
								if (i.canCache())
									return crp.pushInstance(i);
								else
									return i;
							});
					}
					catch(err)
					{
						var result = $.Deferred();
						result.reject(err);
						return result;
					}
				},
				cr.thenFail);
	}

cr.getServiceCounts = function(constraintPath)
{
	constraintPath = constraintPath !== undefined ? constraintPath : 'path';
	
	return $.getJSON(cr.urls.getData + constraintPath + '/servicecounts/')
		.then(function(json)
			{
				try
				{
					return json.words;
				}
				catch(err)
				{
					var result = $.Deferred();
					result.reject(err);
					return result;
				}
			},
			cr.thenFail);
}

cr.getFollowingCounts = function(constraintPath, servicePath)
{
	constraintPath = constraintPath !== undefined ? constraintPath : 'path';
	
	return $.getJSON(cr.urls.getData + constraintPath + '/followingcounts/' + servicePath + '/')
		.then(function(json)
			{
				try
				{
					return json.words;
				}
				catch(err)
				{
					var result = $.Deferred();
					result.reject(err);
					return result;
				}
			},
			cr.thenFail);
}

/* Loads all of the elements of the specified cell within the specified object.
	If the cellName is the name of an objectCell, fieldNames determines the sub-cells that
	are also loaded at the same time.
 */
cr.getCellValues = function(object, cellName, fieldNames)
	{
		var path = '{0}/{1}'.format(object.getInstanceID(), cellName);
		return cr.getData({path: path, fields: fieldNames})
			.then(function(instances)
				{
					var cell = object.getCell(cellName);
					cell.replaceValues(instances);
				},
				function(err)
				{
					r3 = $.Deferred();
					r3.reject(err);
					return r3;
				});
	}

cr.submitSignout = function()
	{
		return $.post(cr.urls.submitSignout, { })
			.then(function(json) {
					cr.signedinUser.clear();
					crp.clear();
					cr.Service.clearPromises();
				},
				cr.thenFail)
			.promise();
	}

cr.updateUsername = function(user, newUsername, password)
	{
		var url = cr.urls.updateUsername;
		if (user)
			url += "user/{0}/".format(user.id());
			
		return $.post(url, {newUsername: newUsername, 
							password: password})
		        .then(function(json)
				{
					user.emails()[0].updateData({text: newUsername}, {});
				},
				cr.thenFail);
	}
	
cr.updatePassword = function(username, oldPassword, newPassword)
	{
		return $.post(cr.urls.updatePassword, {username: username,
										oldPassword: oldPassword,
										newPassword: newPassword })
				.then(function()
					{
					},
					cr.thenFail);
	}

cr.requestAccess = function(follower, followingPath, done, fail)
{
		$.post(cr.urls.requestAccess, {follower: follower.urlPath(),
									   following: followingPath
					  				  })
		.done(done)
		.fail(function(jqXHR, textStatus, errorThrown)
		{
			cr.postFailed(jqXHR, textStatus, errorThrown, fail);
		});
}

cr.removeElement = function(array, item)
{
	if (array)	/* Ensure the array has been initialized. */
	{
		var n = array.indexOf(item);
		if (n >= 0)
			array.splice(n, 1);
	}
}

cr.stringChanged = function(source, target)
{
	if (source === null) source = "";
	if (target === null) target = "";
	return source != target;
}
	
cr.linkChanged = function(source, target)
{
	return (source && source.id()) != (target && target.id());
}
	
cr.IInstance = (function() {
	IInstance.prototype = Object.create(cr.ModelObject.prototype);
	IInstance.prototype.constructor = IInstance;
	
	IInstance.prototype._id = null;
	IInstance.prototype._clientID = null;
	IInstance.prototype._description = "";
	IInstance.prototype._privilege = null;
	IInstance.prototype._parentID = null;
	IInstance.prototype._parent = null;
	IInstance.prototype._fieldsLoaded = [];
	
	IInstance.prototype.id = function(newID)
	{
		if (newID === undefined)
			return this._id;
		else
		{
			this._id = newID;
			return this;
		}
	}
	
	/* The clientID is a temporary id that is used before the item is added.
		The only constraint is that it is unique within a single update operation.
	 */
	IInstance.prototype.clientID = function(newID)
	{
		if (newID === undefined)
			return this._clientID;
		else
		{
			this._clientID = newID;
			return this;
		}
	}
	
	IInstance.prototype.description = function(newDescription)
	{
		if (newDescription === undefined)
			return this._description;
		else
		{
			this._description = newDescription;
			return this;
		}
	}
	
	IInstance.prototype.toString = function()
	{
		return this._description;
	}
	
	IInstance.prototype.privilege = function(newPrivilege)
	{
		if (newPrivilege === undefined)
			return this._privilege;
		else
		{
			this._privilege = newPrivilege;
			return this;
		}
	}
	
	/** if parentID is undefined, returns the parent of this instance. The parent of
	 * an instance is the instance that, when deleted, will automatically delete this instance.
	 *
	 * If parentID is defined, then set the parentID of this instance and return this so that
	 * subsequent operations can be chained.
	 */
	IInstance.prototype.parentID = function(newParentID)
	{
		if (newParentID === undefined)
			return this._parentID;
		else
		{
			this._parentID = newParentID;
			this._parent = null;	/* The parent may or may not be on the client tier. */
			return this;
		}
	}
	
	IInstance.prototype.parent = function(newValue)
	{
		if (newValue === undefined)
		{
			/* Cache the parent if necessary. */
			if (!this._parent && this._parentID)
				this._parent = crp.getInstance(this._parentID);
			return this._parent;
		}
		else
		{
			this._parent = newValue;
			this._parentID = null;
			return this;
		}
	}
	
    IInstance.prototype.promiseData = function(fields)
    {
    	p = this.readCheckPromise();
    	if (p) return p;
    	
    	fields = fields !== undefined ? fields : [];
    	var _this = this;
    	/* Add 'this' to the fields to ensure that the directly stored data of this instance
    		is retrieved.
    	 */
    	fields.push('this');
    	fields = fields.filter(function(f)
    	{
    		return _this._fieldsLoaded.indexOf(f) < 0;
    	});

        if (!this.id() ||		/* This item was never saved. */
        	fields.length == 0)	/* Everything is already loaded. */
        {
        	if (this._dataPromise)
        		return this._dataPromise;
			else
			{
				var result = $.Deferred();
				result.resolve(this);
				return result;
			}
        }
        else
        {
			var _this = this;
		
			var f = function()
			{
				_this._fieldsLoaded = _this._fieldsLoaded.concat(fields);
		
				/* Remove 'this' from the fields when getting data, since it has no meaning on the service. */
				_this._dataPromise = _this.getData(fields.filter(function(f) { return f != 'this'; }))
					.then(function(item)
						{
							console.assert(item == _this);
							_this._dataPromise = null;
							return _this;
						},
						function(err)
						{
							_this._dataPromise = null;
							_this._fieldsLoaded.filter(function(f) { return !(f in fields); });
							var r2 = $.Deferred();
							r2.reject(err);
							return r2;
						});
				return _this._dataPromise;
			}
			if (this._dataPromise)
				return this._dataPromise.then(f);
			else
				return f();
		}
    }
    
	IInstance.prototype.setChildren = function(d, key, childType, children)
	{
		if (key in d)
		{
			var _this = this;
			children.call(this, 
						  d[key].map(function(d) {
								var i = new childType();
								i.setData(d);
								i.parentID(_this.id())
								return crp.pushInstance(i);
							}));
		}
		else
			children.call(this, null);
	}

	IInstance.prototype.setData = function(d)
	{
		if ('id' in d)
			this.id(d['id']);
		if ('description' in d)
			this.description(d['description']);
		if ('privilege' in d)
			this.privilege(d['privilege']);
		if ('parentID' in d)
		    this.parentID(d['parentID']);
		return this;
	}
	
	IInstance.prototype.setDefaultValues = function()
	{
		this._description = "";
		this._id = null;
		this._privilege = 'write';
	}
	
	IInstance.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		/* duplicateForEdit means that this copy is intended to be an edited
			version of the original, so that you can cancel changes.
			If duplicateForEdit is false, then the duplicate is going to be added,
			in which case the IDs shouldn't be copied over.
		 */
		duplicateForEdit = (duplicateForEdit !== undefined) ? duplicateForEdit : true;
		
		newInstance._description = this._description;
		
		if (duplicateForEdit)
		{
			newInstance._id = this._id;
			newInstance._clientID = this._clientID;	/* In case this instance hasn't yet been saved. */
			newInstance._privilege = this._privilege;
			newInstance._parentID = this._parentID;
		}
		return this;
	}
	
	IInstance.prototype.mergeData = function(source)
	{
		if (!this._id) this._id = source._id;
		if (!this._description) this._description = source._description;
		if (!this._privilege) this._privilege = source._privilege;
		if (!this._parentID) this._parentID = source._parentID;
		return this;
	}
	
	/** Returns whether or not this object can be stored in the global
		instance cache.
	 */
	IInstance.prototype.canCache = function()
	{
		return true;
	}
	
	IInstance.prototype.readCheckPromise = function()
	{
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.reject(new Error("You do not have permission to see information about {0}".format(this.description())));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.administerCheckPromise = function()
	{
		if (this.privilege() != cr.privileges.administer)
		{
			var result = $.Deferred();
			result.reject(new Error("You do not have permission to administer {0}".format(this.description())));
			return result.promise();
		}
		else
		    return undefined;
	}
	
	IInstance.prototype.canWrite = function()
	{
		if (this.id() === null)
			throw(this.description() + " has not been saved");
			
		return [cr.privileges.write, cr.privileges.administer].indexOf(this.privilege()) >= 0;
	}
	
	IInstance.prototype.appendUpdateReferenceCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (!f() || f().id() != newValue.id())
		{
			initialData[key] = newValue.id();
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.appendUpdateValueCommand = function(newValue, f, key, initialData, sourceObjects)
	{
		var onChange = {target: this, update: function() { f(newValue); }};
		if (!newValue)
		{
			if (f())
			{
				initialData[key] = null;
				sourceObjects.push(onChange);
			}
		}
		else if (f() != newValue)
		{
			initialData[key] = newValue;
			sourceObjects.push(onChange);
		}
	}
	
	IInstance.prototype.pullNewElements = function(oldElements, newElements)
	{
		var _this = this;
		newElements.forEach(function(i)
			{
				if (i.clientID() && 
					!i.isEmpty() &&
					!oldElements.find(function(e) { return e.clientID() == i.clientID(); }))
				{
					oldElements.push(i);
					i.parent(_this);
				}
			});
		return this;
	}
	
	IInstance.prototype.childAdded = function(item, d, newIDs, addEventType)
	{
		item.parent(this);
		
		if (this.id())
		{
			item.id(newIDs[d['add']])
				.clientID(null);
			item = crp.pushInstance(item);
		}
		
		/* Call updateData so that sub-items also get their IDs.
			updateData also is responsible for ensuring descriptions are calculated
			and change triggers are sent.
		 */
		item.updateData(d, newIDs);
		
		$(this).trigger(addEventType, item);
	}
							
	IInstance.prototype.updateList = function(items, data, newIDs, addEventType)
	{
		console.assert(typeof(items) == "function");
		console.assert(data instanceof Array);
		
		var _this = this;
		items = items.call(this);
		if (items)
		{
			data.forEach(function(d)
				{
					if ('delete' in d)
					{
						var item = items.find(function(i)
							{
								return i.id() == d['delete'];
							});
						if (item)
						{
							item.triggerDeleted();
						}
					}
					else if ('deleteClient' in d)
					{
						var item = items.find(function(i)
							{
								return i.clientID() == d['deleteClient'];
							});
						if (item)
						{
							item.triggerDeleted();
						}
					}
					else if ('add' in d)
					{
						var item = items.find(function(i)
							{
								return i.clientID() == d['add'];
							});
						if (item)
						{
							_this.childAdded(item, d, newIDs, addEventType);
						}
						else
						{
							$(_this).trigger(addEventType, d);
						}
					}
					else if ('id' in d)
					{
						var item = items.find(function(i)
							{
								return i.id() == d['id'];
							});
						if (item)
						{
							item.updateData(d, newIDs);
						}
					}
					else if ('clientID' in d)
					{
						var item = items.find(function(i)
							{
								return i.clientID() == d['clientID'];
							});
						if (item)
						{
							item.updateData(d, newIDs);
						}
					}
					else
						console.assert(false);
				});
		}
		else
		{
			data.forEach(function(d)
				{
					if ('add' in d)
					{
						$(_this).trigger(addEventType, d);
					}
				});
		}
	}
	
	IInstance.prototype.isEmpty = function()
	{
		return false;
	}
	
	IInstance.prototype.appendUpdateList = function(oldItems, newItems, changes, key)
	{
		console.assert(oldItems);
		console.assert(newItems);
		
		var subChanges = [];
		var remainingItems = [];
		oldItems.forEach(function(d)
		{
			console.assert(d.id() || d.clientID());
			var f = d.id() ? 
				function(e)
				{
					return e.id() == d.id() && !e.isEmpty();
				}
				:
				function(e)
				{
					return e.clientID() == d.clientID() && !e.isEmpty();
				};
			var item = newItems.find(f);
			
			if (item)
				remainingItems.push(d);
			else if (d.id())
				subChanges.push({'delete': d.id()});
			else
				subChanges.push({'deleteClient': d.clientID()});	/* Items that were added, not saved and then deleted. */
		});
		
		var j = 0;
		newItems.forEach(function(d)
			{
				if (!d.isEmpty())
				{
					if (j < remainingItems.length)
					{
						var oldItem = remainingItems[j];
						var changes = oldItem.appendChanges(d);
						if (Object.keys(changes).length > 0)
						{
							if (oldItem.id())
								changes.id = oldItem.id();
							else
								changes.clientID = oldItem.clientID();
							subChanges.push(changes);
						}
						++j;
					}
					else
					{
						if (!d.clientID())
							d.clientID(uuid.v4());
						var changes = {add: d.clientID()};
						d.appendData(changes);
						subChanges.push(changes);
					}
				}
			});
		if (subChanges.length > 0)
			changes[key] = subChanges;
	}
	
	IInstance.prototype.duplicateList = function(items, duplicateForEdit)
	{
		return items.map(function(i)
			{
				var target = new i.constructor();
				i.duplicateData(target, duplicateForEdit);
				return target;
			});
	}

	IInstance.prototype.appendList = function(items, initialData, key)
	{
		var f = function(s)
				{
					var d = {add: uuid.v4()};
					s.clientID(d.add);
					s.appendData(d);
					return d;
				}
		var newData = items.map(f);
		if (newData.length)
			initialData[key] = newData;
	}
	
	IInstance.prototype.pullElements = function(source)
	{
		return this;
	}
	
	IInstance.prototype.updateData = function(d, newIDs)
	{
		if ('id' in d)
			this._id = d['id'];
		if ('description' in d)
			this._description = d['description'];
		return false;	/* Changes here do not need to trigger events. */
	}
	
	IInstance.prototype.clear = function()
	{
		this._id = null;
		this._description = null;
		this._parentID = null;
		this._privilege = null;
		this._fieldsLoaded = [];
		return this;
	}

	/* Normally, all of the elements are expected to be part of this, so newIDs are applied
		to existing objects. Otherwise, autoUpdateData should be false, the caller should
		update the data objects as needed and then dall updateData with the changes and newIDs. 
	 */
	IInstance.prototype.update = function(changes, autoUpdateData)
	{
		autoUpdateData = (autoUpdateData !== undefined) ? autoUpdateData : true;
		
		var _this = this;
		if (Object.keys(changes).length == 0)
		{
			var r2 = $.Deferred();
			r2.resolve(changes, {});
			return r2;
		}
		
		return $.post(cr.urls.updateValues + this.urlPath() + '/', 
			{ commands: JSON.stringify(changes)
			})
			.then(function(json)
				{
					var r2 = $.Deferred();
					try
					{
					    /* If the server succeeds, then update this with the changes and any new IDs. */
						newIDs = json['new IDs'];
					    if (autoUpdateData)
					    	_this.updateData(changes, newIDs);
						r2.resolve(changes, newIDs);
					}
					catch (err)
					{
						r2.reject(err);
					}
					return r2;
				},
				cr.thenFail);
	}
	
    IInstance.prototype.getData = function(fields)
    {
    	var _this = this;
    	return cr.getData(
        	{
        		path: this.urlPath(),
        		fields: fields,
        		resultType: this.constructor
        	})
        	.then(function(items)
        	{
        		if (items.length == 0)
        		{
        			r2 = $.Deferred();
        			r2.reject(new Error("this no longer exists"));
        			return r2;
        		}
        		return _this;
        	});
    }
    
	IInstance.prototype.deleteData = function()
	{
		var _this = this;
		
		if (this.id())
		{
			return $.ajax({
					url: cr.urls.getData + this.urlPath() + "/",
					type: 'DELETE',
					data: {'languageCode': 'en'},
				})
				.then(function()
					{
						_this.triggerDeleted();
						return _this;
					},
					cr.thenFail);
		}
		else
		{
			this.triggerDeleted();
			var r = $.Deferred();
			r.resolve(this);
			return r;
		}
	};
	
	IInstance.prototype.triggerChanged = function(target)
	{
		target = target !== undefined ? target : this;
		
		this.calculateDescription();
		$(this).trigger('changed.cr', target);
	}
	
	IInstance.prototype.triggerDeleted = function()
	{
		$(this).trigger('deleted.cr', this);
	}
	
	function IInstance() {
	};
	
	IInstance.updateRoots = function(changes)
	{
		var _this = this;
		if (Object.keys(changes).length == 0)
		{
			var r2 = $.Deferred();
			r2.resolve(changes, {});
			return r2;
		}
		
		return $.post(cr.urls.updateValues, 
			{ commands: JSON.stringify(changes)
			})
			.then(function(json)
				{
					var r2 = $.Deferred();
					try
					{
					    /* If the server succeeds, then update this with the changes and any new IDs. */
						newIDs = json['new IDs'];
						r2.resolve(changes, newIDs);
					}
					catch (err)
					{
						r2.reject(err);
					}
					return r2;
				},
				cr.thenFail);
	}
	
	return IInstance;

})();

/* Since TranslationInstance.updateData triggers a changed message, subobjects shouldn't
	need to add fields or override updateData.
 */
cr.TranslationInstance = (function() {
	TranslationInstance.prototype = Object.create(cr.IInstance.prototype);
	TranslationInstance.prototype.constructor = TranslationInstance;
	
	TranslationInstance.prototype._text = null;
	TranslationInstance.prototype._language = null;
	
	TranslationInstance.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	TranslationInstance.prototype.language = function(newValue)
	{
		if (newValue === undefined)
			return this._language;
		else
		{
		    if (newValue != this._language)
		    {
				this._language = newValue;
			}
			return this;
		}
	}
	
	/** For a newly created DateRangeInstance, set its contents to valid values. */
	TranslationInstance.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._text = "";
		this._language = cr.language || 'en';
	}
	
	TranslationInstance.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._text = this._text;
		newInstance._language = this._language;
		return this;
	}
	
	TranslationInstance.prototype.appendData = function(initialData)
	{
		if (this._text)
			initialData.text = this._text;
		if (this._language)
			initialData.languageCode = this._language;	
	}
	
	TranslationInstance.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.text(), revision.text()))
			changes.text = revision.text();
		if (cr.stringChanged(this.language(), revision.language()))
			changes['languageCode'] = revision.language();
		
		return changes;
	}
	
	TranslationInstance.prototype.isEmpty = function()
	{
		return !this.text();
	}
	
	TranslationInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._text = 'text' in d ? d['text'] : "";
		this._language = 'languageCode' in d ? d['languageCode'] : "";
	}
	
	TranslationInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._text) this._text = source._text;
		if (!this._language) this._language = source._language;
		return this;
	}
	
	TranslationInstance.prototype.calculateDescription = function()
	{
		this._description = this._text;
		return this;
	}
	
	/** Called after the contents of the TranslationInstance have been updated on the server. */
	TranslationInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('text' in d)
		{
			this._text = d['text'];
			changed = true;
		}
		if ('languageCode' in d)
		{
			this._language = d['languageCode'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}
	
	function TranslationInstance() {
	    cr.IInstance.call(this);
	};
	
	TranslationInstance.localText = function(list, language)
	{
		if (!list)
			return "";
		
		language = language !== undefined ? language : 'en';
			
        var enName = '';
        var noneName = '';
		for (var i = 0; i < list.length; ++i)
		{
			var t = list[i];
		    if (language == t.language())
		    	return t.text() || '';
		    else if (t.language() == 'en')
		    	enName = t.text();
		    else if (!t.language())
		    	noneName = t.text();
		}
		return noneName || enEname || '';
	}
	
	return TranslationInstance;

})();

cr.Name = (function() {
	Name.prototype = Object.create(cr.TranslationInstance.prototype);
	Name.prototype.constructor = Name;
	
	Name.prototype.triggerChanged = function()
	{
		cr.IInstance.prototype.triggerChanged.call(this);
		this.parent().triggerChanged(this);
	}
	
	Name.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().names(), this);
		this.parent().triggerChanged(this);
	}
	
	function Name() {
	    cr.TranslationInstance.call(this);
	};
	
	return Name;
})();

/* A mix-in for items that have positions */
cr.OrderedInstance = (function() {
	OrderedInstance.prototype.position = function(newValue)
	{
		if (newValue === undefined)
			return this._position;
		else
		{
		    if (newValue !== this._position)
		    {
				this._position = newValue;
			}
			return this;
		}
	}
	function OrderedInstance() {};
	return OrderedInstance;
})();
	
cr.ServiceLinkInstance = (function() {
	ServiceLinkInstance.prototype = Object.create(cr.IInstance.prototype);
	ServiceLinkInstance.prototype.constructor = ServiceLinkInstance;

	ServiceLinkInstance.prototype._serviceID = null;
	
	ServiceLinkInstance.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._serviceID = null;
	}
	
	ServiceLinkInstance.prototype.service = function(newValue)
	{
		if (newValue === undefined)
			return this._serviceID && crp.getInstance(this._serviceID);
		else
		{
		    if (newValue.id() != this._serviceID)
		    {
				this._serviceID = newValue.id();
			}
			return this;
		}
	}
	
	/** Sets the data for this ServiceLinkInstance based on a dictionary of data that
		came from the server.
	 */
	ServiceLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._serviceID = ('service' in d) ? d['service']['id'] : null;
	}
	
	ServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._serviceID) this._serviceID = source._serviceID;
		return this;
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	ServiceLinkInstance.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.linkChanged(this.service(), revision.service()))
			changes.service = revision.service().urlPath();
			
		return changes;
	}
		
	ServiceLinkInstance.prototype.isEmpty = function()
	{
		return this.service() == null;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	ServiceLinkInstance.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._serviceID = this._serviceID;
		
		return this;
	}
	
	ServiceLinkInstance.prototype.appendData = function(initialData)
	{
		if (this.service() != null)
			initialData.service = this.service().urlPath();
	}
	
	ServiceLinkInstance.prototype.calculateDescription = function()
	{
		this._description = this.service() ? this.service().description() : "";
		return this;
	}
	
	/** Called after the contents of the ServiceLinkInstance have been updated on the server. */
	ServiceLinkInstance.prototype.updateData = function(d, newIDs, canTrigger)
	{
		canTrigger = canTrigger !== undefined ? canTrigger : true;

		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('service' in d)
		{
			var serviceData = d['service'];
			var serviceID;
			if (typeof(serviceData) == "string")
			{
				if (/^service\/[A-Za-z0-9]{32}$/.test(serviceData))
					serviceID = serviceData.substring("service/".length);
				else
					console.assert(false);
			}
			else if ('id' in serviceData)
				serviceID = serviceData['id'];
			else
				console.assert(false);
			
			if (this._serviceID != serviceID)
			{
				this._serviceID = serviceID;
				changed = true;
			}
		}
		
		if (changed && canTrigger)
			this.triggerChanged();
		
		return changed;
	}
	
	function ServiceLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return ServiceLinkInstance;
})();
	
cr.OrderedServiceLinkInstance = (function() {
	OrderedServiceLinkInstance.prototype = Object.create(cr.ServiceLinkInstance.prototype);
	Object.assign(OrderedServiceLinkInstance.prototype, cr.OrderedInstance.prototype);
	OrderedServiceLinkInstance.prototype.constructor = OrderedServiceLinkInstance;

	OrderedServiceLinkInstance.prototype._position = null;
	
	OrderedServiceLinkInstance.prototype.setDefaultValues = function()
	{
		ServiceLinkInstance.prototype.setDefaultValues.call(this);
		this._position = null;
	}
	
	/** Sets the data for this OrderedServiceLinkInstance based on a dictionary of data that
		came from the server.
	 */
	OrderedServiceLinkInstance.prototype.setData = function(d)
	{
		cr.ServiceLinkInstance.prototype.setData.call(this, d);
		this._position = d['position'];
	}
	
	OrderedServiceLinkInstance.prototype.mergeData = function(source)
	{
		cr.ServiceLinkInstance.prototype.mergeData.call(this, source);
		if (this._position === undefined || this._position === null) 
			this._position = source._position;
		return this;
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	OrderedServiceLinkInstance.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.ServiceLinkInstance.prototype.appendChanges.call(this, revision, changes);
			
		if (this.position() != revision.position())
			changes.position = revision.position();

		return changes;
	}
		
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	OrderedServiceLinkInstance.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.ServiceLinkInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._position = this._position;
		
		return this;
	}
	
	OrderedServiceLinkInstance.prototype.appendData = function(initialData)
	{
		console.assert(this.position() !== undefined && this.position() !== null);
		
		cr.ServiceLinkInstance.prototype.appendData.call(this, initialData);
		initialData.position = this.position();
	}
	
	/** Called after the contents of the OrderedServiceLinkInstance have been updated on the server. */
	OrderedServiceLinkInstance.prototype.updateData = function(d, newIDs, canTrigger)
	{
		canTrigger = canTrigger !== undefined ? canTrigger : true;

		var changed = false;
		
		if (cr.ServiceLinkInstance.prototype.updateData.call(this, d, newIDs, false))
			changed = true;
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		
		if (changed && canTrigger)
			this.triggerChanged();
		
		return changed;
	}
	
	function OrderedServiceLinkInstance() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return OrderedServiceLinkInstance;
})();

cr.UserLinkInstance = (function() {
	UserLinkInstance.prototype = Object.create(cr.IInstance.prototype);
	UserLinkInstance.prototype.constructor = UserLinkInstance;

	UserLinkInstance.prototype._user = null;
	
	UserLinkInstance.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._user = null;
	}
	
	UserLinkInstance.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
	UserLinkInstance.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
    }
    
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	UserLinkInstance.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._user = this._user;
		
		return this;
	}
	
	UserLinkInstance.prototype.appendData = function(initialData)
	{
		if (this._user)
			initialData.user = this._user.urlPath();
	}
	
	UserLinkInstance.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._user) this._user = source._user;
		return this;
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	UserLinkInstance.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.linkChanged(this.user(), revision.user()))
			changes.user = revision.user() && revision.user().urlPath();
			
		return changes;
	}
	
	UserLinkInstance.prototype.isEmpty = function()
	{
		return this._user == null;
	}
	
	UserLinkInstance.prototype.calculateDescription = function()
	{
		this.description(this._user ? this._user.description() : "");
		return this;
	}
		
	UserLinkInstance.prototype.updateData = function(d, newIDs, canTrigger)
	{
		canTrigger = canTrigger !== undefined ? canTrigger : true;

		var changed = false;
		if ('user' in d) {
			var userData = d['user'];
			var userID;
			if (typeof(userData) == 'string')
			{
				if (/^user\/[A-Za-z0-9]{32}$/.test(userData))
					userID = userData.substring('user/'.length);
				else
					console.assert(false);
			}
			else if ('id' in userData)
				userID = userData['id'];
			else
				console.assert(false);
				
			var newUser = crp.getInstance(userID);
			if (this._user != newUser)
			{
				this._user = newUser;
				changed = true;
			}
		}
		
		if (changed && canTrigger)
			this.triggerChanged();
		
		return changed;
	}

    UserLinkInstance.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['user'];
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
	function UserLinkInstance() {
	    cr.IInstance.call(this);
	};
	
	return UserLinkInstance;
})();
	
cr.Grantable = (function() {
	Grantable.prototype = Object.create(cr.IInstance.prototype);
	Grantable.prototype.constructor = Grantable;

	Grantable.prototype._userGrants = null;
	Grantable.prototype._groupGrants = null;

	Grantable.prototype.userGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._userGrants;
		else
		{
			this._userGrants = newValue;
			return this;
		}
	}
	
	Grantable.prototype.groupGrants = function(newValue)
	{
		if (newValue === undefined)
			return this._groupGrants;
		else
		{
			this._groupGrants = newValue;
			return this;
		}
	}
	
	Grantable.prototype.appendData = function(initialData)
	{
		/* TODO: append userGrants and groupGrants */
	}

	
	Grantable.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		/* userGrants and groupGrants are not appended to changes. They are, instead,
			always handled uniquely. See postUserGrant.
		 */

		return changes;
	}
	
	Grantable.prototype.clear = function()
	{
		cr.IInstance.prototype.clear.call(this);
		this._userGrants = null;
		this._groupGrants = null;
	}
	
	Grantable.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		
		if ('userGrantType' in this)
		{
			this.setChildren(d, 'user grants', this.userGrantType(), this.userGrants);
			this.setChildren(d, 'group grants', this.groupGrantType(), this.groupGrants);
		}
    }
    
    /** Merge the contents of the specified source into this Grantable for
    	values that are not specified herein.
     */
	Grantable.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._userGrants && source._userGrants)
			this._userGrants = source._userGrants;
		if (!this._groupGrants && source._groupGrants)
			this._groupGrants = source._groupGrants;
		return this;
	}
	
	/** Called after the contents of the Grantable have been updated on the server. */
	Grantable.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('user grants' in d)
		{
			if (this.updateList(this.userGrants, d['user grants'], newIDs, 'userGrantAdded.cr'))
				changed = true;
		}
		if ('group grants' in d)
		{
			if (this.updateList(this.groupGrants, d['group grants'], newIDs, 'groupGrantAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	Grantable.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		/* userGrants and groupGrants can not be edited as part of their containers. 
			They are, instead, always handled uniquely. See postUserGrant.
		 */
		
		return this;
	}
	
	Grantable.prototype.postUserGrant = function(privilege, path)
	{
		var _this = this;

		var changes = [{grantee: path, privilege: privilege}];
		return this.update({'user grants': [{add: '1', grantee: path, privilege: privilege}]})
			.then(function(changes, newIDs)
			{
				var r2 = $.Deferred();
				try
				{
					if (_this.userGrants())
					{
						var newGrant = new (_this.userGrantType())();
						_this.userGrants().push(newGrant);
						newGrant.clientID('1');
						_this.updateData(changes, newIDs);
					}
					r2.resolve(changes, newIDs);
				}
				catch(err)
				{
					r2.reject(err);
				}
				return r2;
			});
	}
	
    function Grantable() {
    	cr.IInstance.call(this);
    }
    
    return Grantable;
    
})();

cr.PublicGrantable = (function() {
	PublicGrantable.prototype = Object.create(cr.Grantable.prototype);
	PublicGrantable.prototype.constructor = PublicGrantable;

	PublicGrantable.prototype._publicAccess = null;
	PublicGrantable.prototype._primaryAdministrator = null;
	
	PublicGrantable.prototype.publicAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._publicAccess;
		else
		{
			if (this._publicAccess != newValue)
			{
				this._publicAccess = newValue;
			}
			return this;
		}
	}
	
	PublicGrantable.prototype.primaryAdministrator = function(newValue)
	{
		if (newValue === undefined)
			return this._primaryAdministrator;
		else
		{
			if (this._primaryAdministrator != newValue)
			{
				this._primaryAdministrator = newValue;
			}
			return this;
		}
	}
	
	PublicGrantable.prototype.appendData = function(initialData)
	{
		if (this.publicAccess())
			initialData['public access'] = this.publicAccess();
			
		if (this.primaryAdministrator())
			initialData['primary administrator'] = this.primaryAdministrator().urlPath();
	}

	
	PublicGrantable.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.Grantable.prototype.appendChanges.call(this, revision, changes);
		
		if (cr.stringChanged(this.publicAccess(), revision.publicAccess()))
			changes['public access'] = revision.publicAccess();
				
		if (cr.linkChanged(this.primaryAdministrator(), revision.primaryAdministrator()))
			changes['primary administrator'] = revision.primaryAdministrator() && revision.primaryAdministrator().urlPath();
		
		return changes;
	}
	
	PublicGrantable.prototype.clear = function()
	{
		cr.Grantable.prototype.clear.call(this);
		this._publicAccess = null;
		this._primaryAdministrator = null;
	}
	
	PublicGrantable.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		this._publicAccess = 'public access' in d ? d['public access'] : "";
		if ('primary administrator' in d)
		{
		    this._primaryAdministrator = new cr.User();
		    this._primaryAdministrator.setData(d['primary administrator']);
		    this._primaryAdministrator = crp.pushInstance(this._primaryAdministrator);
		}
    }
    
    /** Merge the contents of the specified source into this PublicGrantable for
    	values that are not specified herein.
     */
	PublicGrantable.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		if (!this._publicAccess) this._publicAccess = source._publicAccess;
		if (!this._primaryAdministrator) this._primaryAdministrator = source._primaryAdministrator;
		return this;
	}
	
	/** Called after the contents of the PublicGrantable have been updated on the server. */
	PublicGrantable.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		changed = cr.Grantable.prototype.updateData.call(this, d, newIDs);
		if ('public access' in d)
		{
			this._publicAccess = d['public access'];
			changed = true;
		}
		
		if ('primary administrator' in d)
		{
			if (!d['primary administrator'])
				this._primaryAdministrator = null;
			else
			{
				console.assert(d['primary administrator'].startsWith('user/'));
				var userID = d['primary administrator'].substring(5);
				this._primaryAdministrator = crp.getInstance(userID);
			}
		    changed = true;
		}
		
		return changed;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	PublicGrantable.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.Grantable.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._primaryAdministrator = this._primaryAdministrator;
		newInstance._publicAccess = this._publicAccess;
		
		return this;
	}
	
    function PublicGrantable() {
    	cr.Grantable.call(this);
    }
    
    return PublicGrantable;
    
})();

cr.Grant = (function() {
	Grant.prototype = Object.create(cr.IInstance.prototype);
	Grant.prototype.constructor = Grant;

	Grant.prototype._grantee = null;
	Grant.prototype._privilege = null;
	
	Grant.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
		    if (newValue.id() != (this._grantee && this._grantee.id()))
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.privilege = function(newValue)
	{
		if (newValue === undefined)
			return this._privilege;
		else
		{
		    if (newValue != this._privilege)
		    {
				this._privilege = newValue;
			}
			return this;
		}
	}
	
	Grant.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('grantee' in d)
		{
			this._grantee = new (this.granteeType())();
			this._grantee.setData(d['grantee']);
			this._grantee = crp.pushInstance(this._grantee);
		}
		this._privilege = 'privilege' in d ? d['privilege'] : "";
	}
	
	Grant.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._privilege = "";
		this._grantee = null;
	}
	
	Grant.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._privilege = this._privilege;
		newInstance._grantee = this._grantee;
		return this;
	}
	
	Grant.prototype.appendData = function(initialData)
	{
		if (this.privilege())
			initialData['privilege'] = this.privilege();
		if (this.grantee())
			initialData['grantee'] = this.grantee().urlPath();
	}
	
	Grant.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.linkChanged(this.grantee(), revision.grantee()))
			changes['grantee'] = revision.grantee() && revision.grantee().urlPath();
		
		if (cr.stringChanged(this.privilege(), revision.privilege()))
			changes['privilege'] = revision.privilege();
				
		return changes;
	}
	
	Grant.prototype.isEmpty = function()
	{
		return this._grantee == null;
	}
	
	Grant.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._grantee && source.grantee())
			this._grantee = source.grantee();
		if (!this._privilege)
			this._privilege = source.privilege();	
		return this;
	}
	
	Grant.prototype.calculateDescription = function()
	{
		this._description = this._grantee ? this._grantee.description() : "";
		return this;
	}
	
	Grant.prototype.updateData = function(d, newIDs)
	{
		/* Since this object has no sub items, just return if we are being added. */
		if ('add' in d)
			return false;
			
		var changed = false;
		if ('grantee' in d) {
			var granteeData = d['grantee'];
			var granteeID;
			if (typeof(granteeData) == "string")
			{
				if (/\/[A-Za-z0-9]{32}$/.test(granteeData))
					granteeID = granteeData.substring(granteeData.length - 32);
				else
					console.assert(false);
			}
			else if ('id' in granteeData)
				granteeID = granteeData['id'];
			else
				console.assert(false);
				
			var newGrantee = crp.getInstance(granteeID);
			if (this._grantee != newGrantee)
			{
				this._grantee = newGrantee;
				changed = true;
			}
		}
		
		if ('privilege' in d)
		{
			this._privilege = d['privilege'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}

	function Grant() {
	    cr.IInstance.call(this);
	};
	
	return Grant;

})();
	
cr.GroupGrant = (function() {
	GroupGrant.prototype = Object.create(cr.Grant.prototype);
	GroupGrant.prototype.constructor = GroupGrant;
	
	GroupGrant.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().groupGrants(), this);
		$(this.parent()).trigger("groupGrantDeleted.cr", this);
	}
	
	GroupGrant.prototype.granteeType = function()
	{
		return cr.Group;
	}
	
	function GroupGrant() {
	    cr.Grant.call(this);
	};
	
	return GroupGrant;

})();
	
cr.UserGrant = (function() {
	UserGrant.prototype = Object.create(cr.Grant.prototype);
	UserGrant.prototype.constructor = UserGrant;

	UserGrant.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().userGrants(), this);
		$(this.parent()).trigger("userGrantDeleted.cr", this);
	}
	
	UserGrant.prototype.granteeType = function()
	{
		return cr.User;
	}
	
	function UserGrant() {
	    cr.Grant.call(this);
	};
	
	return UserGrant;

})();
	
cr.NamedInstance = (function() {
	NamedInstance.prototype._names = null;
	
	NamedInstance.prototype.names = function(newData)
	{
		if (newData === undefined)
			return this._names;
		else
		{
			if (this._names != newData)
				this._names = newData;
			return this;
		}
	}
	
	NamedInstance.prototype.setNames = function(d, nameType)
	{
		cr.IInstance.prototype.setChildren.call(this, d, 'names', nameType, NamedInstance.prototype.names);
	}

	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	NamedInstance.prototype.duplicateNames = function(newInstance, duplicateForEdit)
	{
		newInstance._names = this.duplicateList(this._names, duplicateForEdit);
		return this;
	}
	
    NamedInstance.prototype.calculateDescription = function()
    {
    	var language = cr.language === undefined ? 'en' : cr.language;
    	var enName = null;
    	var n = this.names().find(function(i)
    		{
    			if (i.language() == 'en')
    				enName = i;
    			return i.language() == language;
    		});
    	n = n || enName;
    	if (n)
    		this.description(n.text());
    	else
    		this.description('');
    }
    
	NamedInstance.prototype.updateNames = function(d, newIDs)
	{
		if ('names' in d)
		{
			this.updateList(this.names, d['names'], newIDs, 'nameAdded.cr');
			return true;
		}
		else
			return false;
	}
		
	function NamedInstance() {};
	return NamedInstance;
})();

cr.WebSiteInstance = (function() {
	WebSiteInstance.prototype.webSite = function(newValue)
	{
		if (newValue === undefined)
			return this._webSite;
		else
		{
		    if (newValue != this._webSite)
		    {
				this._webSite = newValue;
			}
			return this;
		}
	}
	
	function WebSiteInstance() {};
	return WebSiteInstance;
})();

cr.OrganizationLinkInstance = (function() {
	OrganizationLinkInstance.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
			if ((this._organization == null) != (newValue == null) ||
			    (newValue && newValue.id != this._organization.id()))
			{
				this._organization = newValue;
			}
			return this;
		}
	}
	
	OrganizationLinkInstance.prototype.setData = function(d)
	{
		if ('organization' in d) {
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
			this._organization = crp.pushInstance(this._organization);
		}
		else
			this._organization = null;
	}

	OrganizationLinkInstance.prototype.mergeData = function(source)
	{
		if (!this._organization)
			this._organization = source._organization;
		return this;
	}
	
	OrganizationLinkInstance.prototype.appendData = function(initialData)
	{
		if (this.organization())
			initialData['organization'] = this.organization().urlPath();
	}
	
	OrganizationLinkInstance.prototype.appendChanges = function(revision, changes)
	{
		if (cr.linkChanged(this.organization(), revision.organization()))
			changes['organization'] = revision.organization() && revision.organization().urlPath();
	}
	
	OrganizationLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('organization' in d) {
			var organizationData = d['organization'];
			if (organizationData === null)
			{
				/* Test case: Remove this organization link. */
				if (this._organization)
				{
					this._organization = null;
					changed = true;
				}
			}
			else
			{
				var organizationID;
				if (typeof(organizationData) == "string")
				{
					if (/^organization\/[A-Za-z0-9]{32}$/.test(organizationData))
						organizationID = organizationData.substring("organization/".length);
					else
						console.assert(false);
				}
				else if ('id' in organizationData)
					organizationID = organizationData['id'];
				else
					console.assert(false);
				
				var newOrganization = crp.getInstance(organizationID);
				if (this._organization != newOrganization)
				{
					this._organization = newOrganization;
					changed = true;
				}
			}
		}
		
		return changed;
	}

	function OrganizationLinkInstance() {};
	return OrganizationLinkInstance;
})();
	
cr.SiteLinkInstance = (function() {
	SiteLinkInstance.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
			if ((this._site == null) != (newValue == null) ||
			    (newValue && newValue.id != this._site.id()))
			{
				this._site = newValue;
			}
			return this;
		}
	}

	SiteLinkInstance.prototype.setData = function(d)
	{
		if ('site' in d) {
			this._site = new cr.Site();
			this._site.setData(d['site']);
			this._site = crp.pushInstance(this._site);
		}
		else
			this._site = null;
	}

	SiteLinkInstance.prototype.mergeData = function(source)
	{
		if (!this._site)
			this._site = source._site;
		return this;
	}
	
	SiteLinkInstance.prototype.appendData = function(initialData)
	{
		if (this.site())
			initialData['site'] = this.site().urlPath();
	}
	
	SiteLinkInstance.prototype.appendChanges = function(revision, changes)
	{
		if (cr.linkChanged(this.site(), revision.site()))
			changes['site'] = revision.site() && revision.site().urlPath();
	}
	
	SiteLinkInstance.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('site' in d) {
			var siteData = d['site'];
			if (siteData === null)
			{
				/* Test case: Remove this site link. */
				if (this._site)
				{
					this._site = null;
					changed = true;
				}
			}
			else
			{
				var siteID;
				if (typeof(siteData) == "string")
				{
					if (/^site\/[A-Za-z0-9]{32}$/.test(siteData))
						siteID = siteData.substring("site/".length);
					else
						console.assert(false);
				}
				else if ('id' in siteData)
					siteID = siteData['id'];
				else
					console.assert(false);
				
				var newSite = crp.getInstance(siteID);
				if (this._site != newSite)
				{
					this._site = newSite;
					changed = true;
				}
			}
		}
		
		return changed;
	}

	function SiteLinkInstance() {};
	return SiteLinkInstance;
})();
	
cr.OfferingLinkInstance = (function() {
	OfferingLinkInstance.prototype._offering = null;
	OfferingLinkInstance.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
			if ((this._offering == null) != (newValue == null) ||
			    (newValue && newValue.id != this._offering.id()))
			{
				this._offering = newValue;
			}
			return this;
		}
	}

	OfferingLinkInstance.prototype.setOfferingLink = function(d)
	{
		if ('offering' in d) {
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
		}
		else
			this._offering = null;
	}

	OfferingLinkInstance.prototype.mergeOfferingLink = function(source)
	{
		if (!this._offering)
			this._offering = source._offering;
		return this;
	}
	
	OfferingLinkInstance.prototype.appendOfferingLink = function(initialData)
	{
		if (this.offering())
			initialData['offering'] = this.offering().urlPath();
	}
	
	OfferingLinkInstance.prototype.appendOfferingLinkChanges = function(revision, changes)
	{
		if (cr.linkChanged(this.offering(), revision.offering()))
			changes['offering'] = revision.offering() && revision.offering().urlPath();
	}

	OfferingLinkInstance.prototype.updateOfferingLink = function(d, newIDs)
	{
		var changed = false;
		
		if ('offering' in d) {
			var offeringData = d['offering'];
			var offeringID;
			
			if (offeringData === null)
			{
				/* Test case: Remove this offering link. */
				if (this._offering)
				{
					this._offering = null;
					changed = true;
				}
			}
			else
			{
				if (typeof(offeringData) == "string")
				{
					if (/^offering\/[A-Za-z0-9]{32}$/.test(offeringData))
						offeringID = offeringData.substring("offering/".length);
					else
						console.assert(false);
				}
				else if ('id' in offeringData)
					offeringID = offeringData['id'];
				else
					console.assert(false);
			
				var newOffering = crp.getInstance(offeringID);
				if (this._offering != newOffering)
				{
					this._offering = newOffering;
					changed = true;
				}
			}
		}
		
		return changed;
	}

	function OfferingLinkInstance() {};
	return OfferingLinkInstance;
})();
	
cr.DateRangeInstance = (function() {
	DateRangeInstance.prototype._start = null;
	DateRangeInstance.prototype._end = null;

	DateRangeInstance.prototype.start = function(newValue)
	{
		if (newValue === undefined)
			return this._start;
		else
		{
		    if (newValue != this._start)
		    {
				this._start = newValue;
			}
			return this;
		}
	}
	
	DateRangeInstance.prototype.end = function(newValue)
	{
		if (newValue === undefined)
			return this._end;
		else
		{
		    if (newValue != this._end)
		    {
				this._end = newValue;
			}
			return this;
		}
	}
	
	DateRangeInstance.prototype.dateRange = function()
	{
		var startDate = this.start();
		startDate = startDate ? getLocaleDateString(startDate) : "";
		
		var endDate = this.end();
		endDate = endDate ? getLocaleDateString(endDate) : "";
		
		if (startDate || endDate)
			return "{0} - {1}".format(startDate, endDate);
		else
			return "";
	}

	DateRangeInstance.prototype.setDateRange = function(d)
	{
		this._start = 'start' in d ? d['start'] : "";
		this._end = 'end' in d ? d['end'] : "";
	}

	DateRangeInstance.prototype.mergeDateRange = function(source)
	{
		if (!this._start) this._start = source._start;
		if (!this._end) this._end = source._end;
	}
	
	/** For a newly created DateRangeInstance, set its contents to valid values. */
	DateRangeInstance.prototype.setDefaultDateRange = function()
	{
		this._start = "";
		this._end = "";
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	DateRangeInstance.prototype.duplicateDateRange = function(newInstance)
	{
		newInstance._start = this._start;
		newInstance._end = this._end;
		return this;
	}
	
    DateRangeInstance.prototype.appendDateRange = function(initialData)
    {
		if (this.start())
			initialData['start'] = this.start();
		if (this.end())
			initialData['end'] = this.end();
    }
	
	DateRangeInstance.prototype.appendDateRangeChanges = function(revision, changes)
	{	
		if (cr.stringChanged(this.start(), revision.start()))
			changes['start'] = revision.start();
		if (cr.stringChanged(this.end(), revision.end()))
			changes['end'] = revision.end();
	}
	
	DateRangeInstance.prototype.updateDateRange = function(d, newIDs)
	{
		var changed = false;
		
		if ('start' in d)
		{
			this._start = d['start'];
			changed = true;
		}
		if ('end' in d)
		{
			this._end = d['end'];
			changed = true;
		}
		
		return changed;
	}

	function DateRangeInstance() {};
	
	return DateRangeInstance;
})();

cr.Address = (function() {
	Address.prototype = Object.create(cr.IInstance.prototype);
	Address.prototype.constructor = Address;

	Address.prototype._city = null;
	Address.prototype._state = null;
	Address.prototype._zipCode = null;
	Address.prototype._streets = null;
	
	Address.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'address/{0}'.format(this.id());
	}
	
	Address.prototype.city = function(newValue)
	{
		if (newValue === undefined)
			return this._city;
		else
		{
		    if (newValue != this._city)
		    {
				this._city = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.state = function(newValue)
	{
		if (newValue === undefined)
			return this._state;
		else
		{
		    if (newValue != this._state)
		    {
				this._state = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.zipCode = function(newValue)
	{
		if (newValue === undefined)
			return this._zipCode;
		else
		{
		    if (newValue != this._zipCode)
		    {
				this._zipCode = newValue;
			}
			return this;
		}
	}
	
	Address.prototype.streets = function(newValue)
	{
		if (newValue === undefined)
			return this._streets;
		else
		{
		    if (newValue != this._streets)
		    {
				this._streets = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this address based on a dictionary of data that
		came from the server.
	 */
	Address.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._city = 'city' in d ? d['city'] : "";
		this._state = 'state' in d ? d['state'] : "";
		this._zipCode = 'zip code' in d ? d['zip code'] : "";
		this.setChildren(d, 'streets', cr.Street, this.streets);
    }
    
    /** Merge the contents of the specified source into this Address for
    	values that are not specified herein.
     */
	Address.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._city) this._city = source._city;
		if (!this._state) this._state = source._state;
		if (!this._zipCode) this._zipCode = source._zipCode;
		if (!this._streets && source._streets)
			this._streets = source._streets.map(function(i)
				{
					var j = new cr.Street();
					j.mergeData(i);
					return j;
				});
		return this;
	}
	
	/** For a newly created address, set its contents to valid values. */
	Address.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._city = "";
		this._state = "";
		this._zipCode = "";
		this._streets = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	Address.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		newInstance._city = this._city;
		newInstance._state = this._state;
		newInstance._zipCode = this._zipCode;
		newInstance._streets = this.duplicateList(this._streets, duplicateForEdit);
		return this;
	}
	
	Address.prototype.appendData = function(initialData)
	{
		if (this.city())
			initialData['city'] = this.city();
		if (this.state())
			initialData['state'] = this.state();
		if (this.zipCode())
			initialData['zip code'] = this.zipCode();
		this.appendList(this.streets(), initialData, 'streets');
	}
	
	Address.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.city(), revision.city()))
			changes.city = revision.city();
		if (cr.stringChanged(this.state(), revision.state()))
			changes.state = revision.state();
		if (cr.stringChanged(this.zipCode(), revision.zipCode()))
			changes['zip code'] = revision.zipCode();
		
		this.appendUpdateList(this.streets(), revision.streets(), changes, 'streets');		

		return changes;
	}
	
	/** Called after the contents of the Address have been updated on the server. */
	Address.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.streets(), source.streets());
	}
	
	Address.prototype.calculateDescription = function()
	{
		this.description(this.streets().map(function(s) { return s.text(); }).join(" ")
						 + (this.city() ? " " : "") + this.city() 
						 + (this.state() ? " " : "") + this.state()
						 + (this.zipCode() ? "  " : "") + this.zipCode());
	}
	
	Address.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('city' in d)
		{
			this._city = d['city'];
			changed = true;
		}
		if ('state' in d)
		{
			this._state = d['state'];
			changed = true;
		}
		if ('zip code' in d)
		{
			this._zipCode = d['zip code'];
			changed = true;
		}
		if ('streets' in d)
		{
			this.updateList(this.streets, d['streets'], newIDs, 'streetAdded.cr');
			changed = true;
		}
		
		if (changed)
		{
			this.triggerChanged();
		}
			
		return changed;
	}
	
	Address.prototype.triggerChanged = function(target)
	{
		target = target !== undefined ? target : this;
		
		cr.IInstance.prototype.triggerChanged.call(this, target);
		this.parent().triggerChanged(target);
	}
	
	function Address(parent) {
	    cr.IInstance.call(this);
	    this.parent(parent);
	};
	
	return Address;

})();
	
cr.Comment = (function() {
	Comment.prototype = Object.create(cr.IInstance.prototype);
	Comment.prototype.constructor = Comment;

	Comment.prototype._text = null;
	Comment.prototype._question = null;
	Comment.prototype._asker = null;
	
	Comment.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment/{0}'.format(this.id());
	}
	
	Comment.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue != this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.question = function(newValue)
	{
		if (newValue === undefined)
			return this._question;
		else
		{
		    if (newValue != this._question)
		    {
				this._question = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.asker = function(newValue)
	{
		if (newValue === undefined)
			return this._asker;
		else
		{
		    if (newValue != this._asker)
		    {
				this._asker = newValue;
			}
			return this;
		}
	}
	
	Comment.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		if ('asker' in d)
		{
			this._asker = new cr.Path();
			this._asker.setData(d['asker']);
			this._asker = crp.pushInstance(this._asker);
		}
		this._text = 'text' in d ? d['text'] : "";
		this._question = 'question' in d ? d['question'] : "";
    }
    
    Comment.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._asker) this._asker = source._asker;
    	if (!this._text) this._text = source._text;
    	if (!this._question) this._question = source._question;
		return this;
    }
    
	Comment.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._text = "";
		this._question = "";
		this._asker = null;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	Comment.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		newInstance._text = this._text;
		newInstance._question = this._question;
		newInstance._asker = this._asker;
		return this;
	}
	
	Comment.prototype.appendData = function(initialData)
	{
		if (this.text())
			initialData['text'] = this.text();
		if (this.question())
			initialData['question'] = this.question();
		if (this.asker())
			initialData['asker'] = this.asker().urlPath();
	}
	
	Comment.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.text(), revision.text()))
			changes.text = revision.text();
		if (cr.stringChanged(this.question(), revision.question()))
			changes.question = revision.question();
			
		if (cr.linkChanged(this.asker(), revision.asker()))
			changes.asker = revision.asker() && revision.asker().urlPath();
		
		return changes;
	}
	
	Comment.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().comments(), this);
		$(this.parent()).trigger("commentDeleted.cr", this);
	}
	
	Comment.prototype.calculateDescription = function()
	{
		this._description = this._text;
	}
	
	Comment.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		if ('question' in d)
		{
			if (this._question != d['question'])
			{
				this._question = d['question'];
				changed = true;
			}
		}
		if ('text' in d)
		{
			if (this._text != d['text'])
			{
				this._text = d['text'];
				changed = true;
			}
		}
		
		if ('asker' in d) {
			var askerData = d['asker'];
			var pathID;
			if (typeof(askerData) == "string")
			{
				if (/^path\/[A-Za-z0-9]{32}$/.test(askerData))
					pathID = askerData.substring("path/".length);
				else
					console.assert(false);
			}
			else if ('id' in askerData)
				pathID = askerData['id'];
			else
				console.assert(false);
				
			var newPath = crp.getInstance(pathID);
			if (this._asker != newPath)
			{
				this._asker = newPath;
				changed = true;
			}
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}

	function Comment() {
	    cr.IInstance.call(this);
	};
	
	return Comment;

})();
	
cr.CommentPrompt = (function() {
	CommentPrompt.prototype = Object.create(cr.IInstance.prototype);
	CommentPrompt.prototype.constructor = CommentPrompt;

	CommentPrompt.prototype._translations = null;
	
	CommentPrompt.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment prompt/{0}'.format(this.id());
	}
	
	CommentPrompt.prototype.translations = function(newValue)
	{
		if (newValue === undefined)
			return this._translations;
		else
		{
		    if (newValue != this._translations)
		    {
				this._translations = newValue;
			}
			return this;
		}
	}
	
	CommentPrompt.prototype.names = CommentPrompt.prototype.translations;
	
	CommentPrompt.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setChildren(d, 'translations', cr.CommentPromptText, this.translations);
    }
    
	CommentPrompt.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._translations)
			this._translations = source._translations;
		return this;
    }
    
	CommentPrompt.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._translations = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	CommentPrompt.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		newInstance._translations = this.duplicateList(this._translations, duplicateForEdit);
		return this;
	}
	
	CommentPrompt.prototype.appendData = function(initialData)
	{
		this.appendList(this.translations(), initialData, 'translations');
	}
	
	CommentPrompt.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
				
		this.appendUpdateList(this.translations(), revision.translations(), changes, 'translations');		

		return changes;
	}
	
    CommentPrompt.prototype.calculateDescription = cr.NamedInstance.prototype.calculateDescription;

	/** Called after the contents of the CommentPrompt have been updated on the server. */
	CommentPrompt.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.translations(), source.translations());
	}
	
	CommentPrompt.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('translations' in d)
		{
			this.updateList(this.translations, d['translations'], newIDs, 'translationAdded.cr');
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}
	
	function CommentPrompt() {
	    cr.IInstance.call(this);
	};
	
	return CommentPrompt;

})();
	
cr.CommentPromptText = (function() {
	CommentPromptText.prototype = Object.create(cr.Name.prototype);
	CommentPromptText.prototype.constructor = CommentPromptText;
	
	CommentPromptText.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'comment prompt translation/{0}'.format(this.id());
	}
	
	CommentPromptText.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().translations(), this);
		$(this.parent()).trigger("commentPromptTextDeleted.cr", this);
	}
	
	function CommentPromptText() {
	    cr.Name.call(this);
	};
	
	return CommentPromptText;

})();
	
cr.Engagement = (function() {
	Engagement.prototype = Object.create(cr.UserLinkInstance.prototype);
	Object.assign(Engagement.prototype, cr.OfferingLinkInstance.prototype);
	Object.assign(Engagement.prototype, cr.DateRangeInstance.prototype);
	Engagement.prototype.constructor = Engagement;

	Engagement.prototype._user = null;
	Engagement.prototype._organization = null;
	Engagement.prototype._site = null;
	
	Engagement.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'engagement/{0}'.format(this.id());
	}
	
	Engagement.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	Engagement.prototype.site = cr.SiteLinkInstance.prototype.site;

	Engagement.prototype.setData = function(d)
	{
		cr.UserLinkInstance.prototype.setData.call(this, d);
		this.setDateRange(d);
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
		this.setOfferingLink(d);
    }
    
    Engagement.prototype.mergeData = function(source)
    {
		cr.UserLinkInstance.prototype.mergeData.call(this, source);
		this.mergeDateRange(source);
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		this.mergeOfferingLink(source);
		return this;
    }
    
	Engagement.prototype.setDefaultValues = function()
	{
    	cr.UserLinkInstance.prototype.setDefaultValues.call(this);
    	this.setDefaultDateRange();
	}
	
	Engagement.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.UserLinkInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
    	this.duplicateDateRange(newInstance);
		
		return this;
	}
	
	Engagement.prototype.appendData = function(initialData)
    {
    	cr.UserLinkInstance.prototype.appendData.call(this, initialData);
    	this.appendDateRange(initialData);
    }
    
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Engagement.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.UserLinkInstance.prototype.appendChanges.call(this, revision, changes);
		this.appendDateRangeChanges(revision, changes);
			
		return changes;
	}
		
	Engagement.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.UserLinkInstance.prototype.updateData.call(this, d, newIDs, false))
			changed = true;
			
		if (this.updateDateRange(d, newIDs))
			changed = true;
		
		if (changed)
			this.triggerChanged();

		return changed;
	}

	Engagement.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().engagements(), this);
		$(this.parent()).trigger("engagementDeleted.cr", this);
	}
	
	function Engagement() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Engagement;

})();
	
cr.Enrollment = (function() {
	Enrollment.prototype = Object.create(cr.UserLinkInstance.prototype);
	Enrollment.prototype.constructor = Enrollment;

	Enrollment.prototype._session = null;
	
	Enrollment.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'enrollment/{0}'.format(this.id());
	}
	
	Enrollment.prototype.session = function(newValue)
	{
		if (newValue === undefined)
			return this._session;
		else
		{
		    if (newValue != this._session)
		    {
				this._session = newValue;
			}
			return this;
		}
	}
	
	Enrollment.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().enrollments(), this);
		$(this.parent()).trigger("enrollmentDeleted.cr", this);
	}
	
	function Enrollment() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Enrollment;

})();
	
cr.Experience = (function() {
	Experience.prototype = Object.create(cr.Grantable.prototype);
	Object.assign(Experience.prototype, cr.OfferingLinkInstance.prototype);
	Object.assign(Experience.prototype, cr.DateRangeInstance.prototype);
	Experience.prototype.constructor = Experience;

	Experience.prototype._path = null;
	Experience.prototype._organization = null;
	Experience.prototype._customOrganization = null;
	Experience.prototype._site = null;
	Experience.prototype._customSite = null;
	Experience.prototype._customOffering = null;
	Experience.prototype._engagement = null;
	Experience.prototype._timeframe = null;
	Experience.prototype._isHidden = null;
	Experience.prototype._services = null;
	Experience.prototype._customServices = null;
	Experience.prototype._comments = null;
	
	Experience.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience/{0}'.format(this.id());
	}
	
	Experience.prototype.path = function(newValue)
	{
		if (newValue === undefined)
			return this._path;
		else
		{
		    if (newValue != this._path)
		    {
				this._path = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	Experience.prototype.site = cr.SiteLinkInstance.prototype.site;
	
	Experience.prototype.customOrganization = function(newValue)
	{
		if (newValue === undefined)
			return this._customOrganization;
		else
		{
		    if (newValue != this._customOrganization)
		    {
				this._customOrganization = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.customSite = function(newValue)
	{
		if (newValue === undefined)
			return this._customSite;
		else
		{
		    if (newValue != this._customSite)
		    {
				this._customSite = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.customOffering = function(newValue)
	{
		if (newValue === undefined)
			return this._customOffering;
		else
		{
		    if (newValue != this._customOffering)
		    {
				this._customOffering = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.engagement = function(newValue)
	{
		if (newValue === undefined)
			return this._engagement;
		else
		{
		    if (newValue != this._engagement)
		    {
				this._engagement = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.timeframe = function(newValue)
	{
		if (newValue === undefined)
			return this._timeframe;
		else
		{
		    if (newValue != this._timeframe)
		    {
				this._timeframe = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.isHidden = function(newValue)
	{
		if (newValue === undefined)
			return this._isHidden;
		else
		{
		    if (newValue != this._isHidden)
		    {
				this._isHidden = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.experienceServices = function(newValue)
	{
		if (newValue === undefined)
		{
			if (this._services)
				cr.assertArrayType(this._services, cr.ExperienceService);
			return this._services;
		}
		else
		{
		    if (newValue != this._services)
		    {
		    	cr.assertArrayType(newValue, cr.ExperienceService);
				this._services = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.distinctExperienceServices = function()
	{
		var existingServices = null;
		if (this.offering() && this.offering().offeringServices())
			existingServices = this.offering().offeringServices()
				.map(function(os) { return os.service(); });
		
		return this.experienceServices().filter(
			function(s)
				{
					return !existingServices || 
						   !existingServices.find(function(d) { 
							return s.service().id() == d.id(); 
						});
				});	
	}
	
	Experience.prototype.customServices = function(newValue)
	{
		if (newValue === undefined)
			return this._customServices;
		else
		{
		    if (newValue != this._customServices)
		    {
				this._customServices = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.comments = function(newValue)
	{
		if (newValue === undefined)
			return this._comments;
		else
		{
		    if (newValue != this._comments)
		    {
				this._comments = newValue;
			}
			return this;
		}
	}
	
	Experience.prototype.setDefaultValues = function()
	{
		cr.Grantable.prototype.setDefaultValues.call(this);
		this.setDefaultDateRange();
		this._organization = null;
		this._customOrganization = "";
		this._site = null;
		this._customSite = "";
		this._offering = null;
		this._customOffering = "";
		this._engagement = null;
		this._timeframe = "Previous";
		this._isHidden = false;
		this._services = [];
		this._customServices = [];
		this._comments = [];
	}
	
	Experience.prototype.appendData = function(initialData)
	{
    	this.appendDateRange(initialData);
    
		cr.OrganizationLinkInstance.prototype.appendData.call(this, initialData);
		if (this.customOrganization())
			initialData['custom organization'] = this.customOrganization();
			
		cr.SiteLinkInstance.prototype.appendData.call(this, initialData);
		if (this.customSite())
			initialData['custom site'] = this.customSite();
			
		this.appendOfferingLink(initialData);
		if (this.customOffering())
			initialData['custom offering'] = this.customOffering();
		
		if (this.engagement())
			initialData['engagement'] = this.engagement().urlPath();
			
		if (this.timeframe())
			initialData['timeframe'] = this.timeframe();
		
		initialData['is hidden'] = this.isHidden();
		
		var i = 0;
		
		this.appendList(this.distinctExperienceServices(), initialData, 'services');
		this.appendList(this.customServices(), initialData, 'custom services');
		
		if (this.comments())
			this.appendList(this.comments(), initialData, 'comments');
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Experience.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		cr.OrganizationLinkInstance.prototype.appendChanges.call(this, revision, changes);
		cr.SiteLinkInstance.prototype.appendChanges.call(this, revision, changes);
		this.appendOfferingLinkChanges(revision, changes);

		if (cr.linkChanged(this.engagement(), revision.engagement()))
			changes['engagement'] = revision.engagement() && revision.engagement().urlPath();

		if (cr.stringChanged(this.customOrganization(), revision.customOrganization()))
			changes['custom organization'] = revision.customOrganization();
				
		if (cr.stringChanged(this.customSite(), revision.customSite()))
			changes['custom site'] = revision.customSite();
				
		if (cr.stringChanged(this.customOffering(), revision.customOffering()))
			changes['custom offering'] = revision.customOffering();
				
		this.appendDateRangeChanges(revision, changes);
		if (cr.stringChanged(this.timeframe(), revision.timeframe()))
			changes['timeframe'] = revision.timeframe();
		
		if (this.isHidden() != revision.isHidden())
			changes['is hidden'] = revision.isHidden();
		
		this.appendUpdateList(this.experienceServices(), revision.distinctExperienceServices(), changes, 'services');
		this.appendUpdateList(this.customServices(), revision.customServices(), changes, 'custom services');
		
		return changes;
	}
	
	Experience.prototype.setData = function(d)
	{
		cr.Grantable.prototype.setData.call(this, d);
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
		this.setOfferingLink(d);
		this.setDateRange(d);

		if ('engagement' in d) {
			this._engagement = new cr.Engagement();
			this._engagement.setData(d['engagement']);
			this._engagement = crp.pushInstance(this._engagement);
		}
		else
			this._engagement = null;

		this._customOrganization = 'custom organization' in d ? d['custom organization'] : "";
		this._customSite = 'custom site' in d ? d['custom site'] : "";
		this._customOffering = 'custom offering' in d ? d['custom offering'] : "";
		this._timeframe = 'timeframe' in d ? d['timeframe'] : "";
		this._isHidden = 'is hidden' in d ? d['is hidden'] : false;
		this.setChildren(d, 'services', cr.ExperienceService, this.experienceServices);
		this.setChildren(d, 'custom services', cr.ExperienceCustomService, this.customServices);
		this.setChildren(d, 'comments', cr.Comment, this.comments);
    }
    
    /** Merge the contents of the specified source into this Experience for
    	values that are not specified herein.
     */
	Experience.prototype.mergeData = function(source)
	{
		cr.Grantable.prototype.mergeData.call(this, source);
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		this.mergeOfferingLink(source);
		this.mergeDateRange(source);
		if (!this._engagement) this._engagement = source._engagement;
		if (!this._customOrganization) this._customOrganization = source._customOrganization;
		if (!this._customSite) this._customSite = source._customSite;
		if (!this._customOffering) this._customOffering = source._customOffering;
		if (!this._timeframe) this._timeframe = source._timeframe;
		this._isHidden = source._isHidden;
		if (!this._services) this._services = source._services;
		if (!this._customServices) this._customServices = source._customServices;
		if (!this._comments) this._comments = source._comments;
		return this;
	}
	
	Experience.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.experienceServices(), source.experienceServices())
				   .pullNewElements(this.customServices(), source.customServices());
	}
	
	Experience.prototype.updateEngagementLink = function(d, newIDs)
	{
		var changed = false;
		
		if ('engagement' in d) {
			var data = d['engagement'];
			var id;
			if (typeof(data) == "string")
			{
				if (/^engagement\/[A-Za-z0-9]{32}$/.test(data))
					id = data.substring('engagement/'.length);
				else
					console.assert(false);
			}
			else if ('id' in data)
				id = data['id'];
			else
				console.assert(false);
			
			var newLink = crp.getInstance(id);
			if (this._engagement != newLink)
			{
				this._engagement = newLink;
				changed = true;
			}
		}
		
		return changed;
	}

	/** Called after the contents of the Experience have been updated on the server. */
	Experience.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.Grantable.prototype.updateData.call(this, d, newIDs);
		if (cr.OrganizationLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (cr.SiteLinkInstance.prototype.updateData.call(this, d, newIDs))
			changed = true;
		if (this.updateOfferingLink(d, newIDs))
			changed = true;
		if (this.updateEngagementLink(d, newIDs))
			changed = true;
		if (this.updateDateRange(d, newIDs))
			changed = true;
		if ('custom organization' in d)
		{
			this._customOrganization = d['custom organization'];
			changed = true;
		}
		if ('custom site' in d)
		{
			this._customSite = d['custom site'];
			changed = true;
		}
		if ('custom offering' in d)
		{
			this._customOffering = d['custom offering'];
			changed = true;
		}
		if ('timeframe' in d)
		{
			this._timeframe = d['timeframe'];
			changed = true;
		}
		if ('is hidden' in d)
		{
			this._isHidden = d['is hidden'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		if ('services' in d)
		{
			if (this.updateList(this.experienceServices, d['services'], newIDs, 'experienceServiceAdded.cr'))
				changed = true;
		}
		if ('custom services' in d)
		{
			if (this.updateList(this.customServices, d['custom services'], newIDs, 'customServiceAdded.cr'))
				changed = true;
		}
		if ('comments' in d)
		{
			if (this.updateList(this.comments, d['comments'], newIDs, 'commentAdded.cr'))
				changed = true;
		}

		return changed;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	Experience.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.Grantable.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
    	this.duplicateDateRange(newInstance);
		newInstance._path = this._path;
		newInstance._organization = this._organization;
		newInstance._customOrganization = this._customOrganization
		newInstance._site = this._site;
		newInstance._customSite = this._customSite;
		newInstance._offering = this._offering;
		newInstance._customOffering = this._customOffering;
		newInstance._engagement = this._engagement;
		
		/* Initialize previously null timeframes to reasonable values. */
		newInstance._timeframe = this.getPhase();
		
		newInstance._isHidden = this._isHidden;
		
		newInstance._services = this.duplicateList(this._services, duplicateForEdit);
		newInstance._customServices = this.duplicateList(this._customServices, duplicateForEdit);
		
		if (duplicateForEdit)
		{
			if (this._comments)
				newInstance._comments = this.duplicateList(this._comments, duplicateForEdit);
		}
		
		return this;
	}
	
	Experience.prototype.userGrantType = function()
	{
		return cr.ExperienceUserGrant;
	}
	
	Experience.prototype.groupGrantType = function()
	{
		return cr.ExperienceGroupGrant;
	}
	
	Experience.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().experiences(), this);
		$(this.parent()).trigger("experienceDeleted.cr", this);
	}
	
	Experience.prototype.calculateDescription = function(language)
	{
// 		if (!this.getCells())
// 		{
// 			if (!this.description())
// 				this.description("None");
// 		}
// 		else
		{
			if (this._offering)
				this.description(this._offering.description());
			else if (this._customOffering)
			    this.description(this._customOffering);
			else
			    this.description('Unnamed Offering');
		}
	}
	
	Experience.prototype.pickedOrCreatedText = function(picked, created)
	{
		if (picked && picked.id())
			return picked.description();
		else
			return created;
	}

	Experience.prototype.getTagList = function()
	{
		var names = [];
	
		var offering = this.offering();
		if (offering && offering.id())
		{
			if (!offering.offeringServices())
				throw new Error("Runtime error: offering services are not loaded");
			
			names = offering.offeringServices()
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); });
		}
	
		var services = this.experienceServices();
		var customServices = this.customServices();

		if (services)
			names = names.concat(services
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		if (customServices)
			names = names.concat(customServices
				.filter(function(v) { return !v.isEmpty(); })
				.map(function(v) { return v.description(); }));
	
		return names.join(", ");
	}

	Experience.prototype.getPhase = function()
	{
		var t = this.timeframe();
		if (t)
			return t;
			
		var todayDate = getUTCTodayDate().toISOString().substr(0, 10);
		if (!this.start() || this.start() > todayDate)
			return 'Goal';
		else if (!this.end() || this.end() > todayDate)
			return 'Current';
		else
			return 'Previous';
	}
	
	Experience.prototype.organizationName = function()
	{
		if (this.organization())
		    return this.organization().description();
		else
		    return this.customOrganization();
	}
	
	Experience.prototype.siteName = function()
	{
		if (this.site())
		    return this.site().description();
		else
		    return this.customSite();
	}
	
	Experience.prototype.offeringName = function()
	{
		if (this.offering())
		    return this.offering().description();
		else
		    return this.customOffering();
	}
	
	/* Returns a name associated with this experience generated from its tags. */
	Experience.prototype.tagName = function()
	{
		return (this.experienceServices() &&
		        this.experienceServices().length &&
		        this.experienceServices()[0].description()) ||
		       (this.customServices() &&
		        this.customServices().length &&
		        this.customServices()[0].description());
	}
	
	Experience.prototype.postComment = function(changes)
	{
		/* Test case: add a comment to an experience. */
		var _this = this;
		changes.add = '1';
		return this.update({comments: [changes]}, false)
				.then(function(changes, newIDs)
					{
						var r2 = $.Deferred();
						try
						{
							var newComment = new cr.Comment();
							_this.comments().push(newComment);
							newComment.clientID('1');
							_this.updateData(changes, newIDs)
							r2.resolve(changes, newIDs);
						}
						catch(err)
						{
							r2.reject(err);
						}
						return r2;
					});
	}
	
	Experience.prototype.containsService = function(service)
	{
		return this.experienceServices().find(function(es)
			{
				return es.service().serviceImplications().findIndex(function(s2)
					{
						return service.id() == s2.service().id();
					}) >= 0;
			}) ||
			(this.offering() && 
			 this.offering().offeringServices() && 
			 this.offering().offeringServices().find(function(es)
				{
					return es.service().serviceImplications().findIndex(function(s2)
						{
							return service.id() == s2.service().id();
						}) >= 0;
				}));
	}
	
	function Experience() {
	    cr.Grantable.call(this);
	};
	
	return Experience;

})();
	
cr.ExperienceCustomService = (function() {
	ExperienceCustomService.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(ExperienceCustomService.prototype, cr.OrderedInstance.prototype);
	ExperienceCustomService.prototype.constructor = ExperienceCustomService;

	ExperienceCustomService.prototype._name = null;
	ExperienceCustomService.prototype._position = null;
	
	ExperienceCustomService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience custom service/{0}'.format(this.id());
	}
	
	ExperienceCustomService.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	ExperienceCustomService.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._position = 'position' in d ? d['position'] : 0;
    }
    
    ExperienceCustomService.prototype.mergeData = function(source)
    {
    	cr.IInstance.prototype.mergeData.call(this, source);
    	if (!this._name) this._name = source._name;
    	if (this._position === null) this._position = source._position;
		return this;
    }
        
	ExperienceCustomService.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		
		var experience = this.parent();
		cr.removeElement(experience.customServices(), this);
		$(experience).trigger("customServiceDeleted.cr", this);
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	ExperienceCustomService.prototype.setDefaultValues = function()
	{
		newInstance._name = "";
		newInstance._position = 0;
	}
	
	ExperienceCustomService.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._name = this._name;
		newInstance._position = this._position;
		return this;
	}
	
	ExperienceCustomService.prototype.appendData = function(initialData)
	{
		if (this.name())
			initialData.name = this.name();
		
		if (this.position() != null)
			initialData.position = this.position();
	}
	
	ExperienceCustomService.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.name(), revision.name()))
			changes.name = revision.name();
			
		if (this.position() != revision.position())
			changes.position = revision.position();
			
		return changes;
	}
		
	ExperienceCustomService.prototype.calculateDescription = function()
	{
		this.description(this._name);
	}
		
	ExperienceCustomService.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if ('name' in d)
		{
			this._name = d['name'];
			changed = true;
		}
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
	
		return changed;
	}
	
	ExperienceCustomService.prototype.triggerChanged = function()
	{
		cr.IInstance.prototype.triggerChanged.call(this);
		this.parent().triggerChanged(this);
	}
	
	function ExperienceCustomService() {
	    cr.IInstance.call(this);
	};
	
	return ExperienceCustomService;

})();
	
cr.ExperienceService = (function() {
	ExperienceService.prototype = Object.create(cr.OrderedServiceLinkInstance.prototype);
	ExperienceService.prototype.constructor = ExperienceService;
	
	ExperienceService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience service/{0}'.format(this.id());
	}
	
	ExperienceService.prototype.triggerChanged = function()
	{
		cr.IInstance.prototype.triggerChanged.call(this);
		this.parent().triggerChanged(this);
	}
	
	ExperienceService.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		
		var experience = this.parent();
		cr.removeElement(experience.experienceServices(), this);
		$(experience).trigger('experienceServiceDeleted.cr', this);
	}
	
	function ExperienceService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return ExperienceService;

})();
	
cr.ExperienceUserGrant = (function() {
	ExperienceUserGrant.prototype = Object.create(cr.UserGrant.prototype);
	ExperienceUserGrant.prototype.constructor = ExperienceUserGrant;

	ExperienceUserGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience user grant/{0}'.format(this.id());
	}
	
	function ExperienceUserGrant() {
	    cr.UserGrant.call(this);
	};
	
	return ExperienceUserGrant;

})();
	
cr.ExperienceGroupGrant = (function() {
	ExperienceGroupGrant.prototype = Object.create(cr.GroupGrant.prototype);
	ExperienceGroupGrant.prototype.constructor = ExperienceGroupGrant;

	ExperienceGroupGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'experience group grant/{0}'.format(this.id());
	}
	
	function ExperienceGroupGrant() {
	    cr.GroupGrant.call(this);
	};
	
	return ExperienceGroupGrant;

})();
	
cr.Group = (function() {
	Group.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Group.prototype, cr.NamedInstance.prototype);
	Group.prototype.constructor = Group;

	Group.prototype._members = null;
	
	Group.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group/{0}'.format(this.id());
	}
	
	Group.prototype.members = function(newValue)
	{
		if (newValue === undefined)
			return this._members;
		else
		{
		    if (newValue != this._members)
		    {
				this._members = newValue;
			}
			return this;
		}
	}
	
	/** For a newly created Group, set its contents to valid values. */
	Group.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._names = [];
		this._members = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	Group.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
		newInstance._members = this.duplicateList(this._members, duplicateForEdit);
		
		return this;
	}
	
	Group.prototype.appendData = function(initialData)
	{
		this.appendList(this.members(), initialData, 'members');
		this.appendList(this.names(), initialData, 'names');
	}
	
	Group.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		this.appendUpdateList(this.members(), revision.members(), changes, 'members');		
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		

		return changes;
	}
	
	Group.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setNames(d, cr.GroupName);
		this.setChildren(d, 'members', cr.GroupMember, this.members);
    }
    
    /** Merge the contents of the specified source into this Group for
    	values that are not specified herein.
     */
	Group.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._members && source._members)
			this._members = source._members;
		return this;
	}
	
	/** For a newly updated item, add any new elements created to this. */
	Group.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.names(), source.names());
	}
	
	/** Called after the contents of the Group have been updated on the server. */
	Group.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (this.updateNames(d, newIDs))
			changed = true;
		
		if (changed)
			this.triggerChanged();
			
		if ('members' in d)
		{
			if (this.updateList(this.members, d['members'], newIDs, 'memberAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
	Group.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().groups(), this);
		$(this.parent()).trigger("groupDeleted.cr", this);
	}
	
	function Group() {
	    cr.IInstance.call(this);
	};
	
	return Group;

})();
	
cr.GroupName = (function() {
	GroupName.prototype = Object.create(cr.Name.prototype);
	GroupName.prototype.constructor = GroupName;
	
	GroupName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group name/{0}'.format(this.id());
	}
	
	function GroupName() {
	    cr.Name.call(this);
	};
	
	return GroupName;

})();
	
cr.GroupMember = (function() {
	GroupMember.prototype = Object.create(cr.UserLinkInstance.prototype);
	GroupMember.prototype.constructor = GroupMember;
	
	GroupMember.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().members(), this);
		$(this.parent()).trigger("memberDeleted.cr", this);
	}
	
	GroupMember.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'group member/{0}'.format(this.id());
	}
	
	function GroupMember() {
	    cr.UserLinkInstance.call(this);
	};
	
	return GroupMember;

})();
	
cr.Inquiry = (function() {
	Inquiry.prototype = Object.create(cr.UserLinkInstance.prototype);
	Inquiry.prototype.constructor = Inquiry;

	Inquiry.prototype._session = null;
	
	Inquiry.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'inquiry/{0}'.format(this.id());
	}
	
	Inquiry.prototype.session = function(newValue)
	{
		if (newValue === undefined)
			return this._session;
		else
		{
		    if (newValue != this._session)
		    {
				this._session = newValue;
			}
			return this;
		}
	}
	
	Inquiry.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().inquiries(), this);
		$(this.parent()).trigger("inquiryDeleted.cr", this);
	}
	
	function Inquiry() {
	    cr.UserLinkInstance.call(this);
	};
	
	return Inquiry;

})();
	
cr.Notification = (function() {
	Notification.prototype = Object.create(cr.IInstance.prototype);
	Notification.prototype.constructor = Notification;

	Notification.prototype._name = null;
	Notification.prototype._isFresh = null;
	Notification.prototype._arguments = null;
	
	Notification.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'notification/{0}'.format(this.id());
	}
	
	Notification.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.isFresh = function(newValue)
	{
		if (newValue === undefined)
			return this._isFresh;
		else
		{
		    if (newValue != this._isFresh)
		    {
				this._isFresh = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.appendUpdateIsFreshCommand = function(newValue, initialData, sourceObjects)
	{
		this.appendUpdateValueCommand(newValue, 
			this.isFresh, 'is fresh', initialData, sourceObjects);
	}

	/* Use the abbreviation args instead of arguments because "arguments" is 
	   a reserved word in Javascript.
	 */
	Notification.prototype.args = function(newValue)
	{
		if (newValue === undefined)
			return this._arguments;
		else
		{
		    if (newValue != this._arguments)
		    {
				this._arguments = newValue;
			}
			return this;
		}
	}
	
	Notification.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._name = 'name' in d ? d['name'] : "";
		this._isFresh = 'is fresh' in d ? d['is fresh'] : "";
		var f = this.controller();
		this._arguments = f.parseArguments(d['arguments']);
    }
    
    /** Merge the contents of the specified source into this Notification for
    	values that are not specified herein.
     */
	Notification.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._name) this._name = source._name;
		if (!this._isFresh) this._isFresh = source._isFresh;
		if (!this._arguments)
			this._arguments = source._arguments;
		return this;
	}
	
	Notification.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		
		user = this.parent();
		cr.removeElement(user.notifications(), this);
		$(user).trigger("notificationDeleted.cr", this);
	}
	
	Notification.prototype.calculateDescription = function()
	{
		this.description(this.name());
	}
	
	/** Called after the contents of the Notification have been updated on the server. */
	Notification.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('is fresh' in d)
		{
			this._isFresh = d['is fresh'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}
	
    Notification.prototype.controller = function()
    {
    	return crn[this._name.split(".")[1]];
    }
    
	function Notification() {
	    cr.IInstance.call(this);
	};
	
	return Notification;

})();
	
cr.NotificationArgument = (function() {
	NotificationArgument.prototype = Object.create(cr.IInstance.prototype);
	NotificationArgument.prototype.constructor = NotificationArgument;
	
	function NotificationArgument() {
	    cr.IInstance.call(this);
	};
	
	return NotificationArgument;

})();
	
cr.Offering = (function() {
	Offering.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Offering.prototype, cr.NamedInstance.prototype);
	Offering.prototype.constructor = Offering;

	Offering.prototype._names = null;
    Offering.prototype._webSite = null;
    Offering.prototype._minimumAge = null;
    Offering.prototype._maximumAge = null;
    Offering.prototype._minimumGrade = null;
    Offering.prototype._maximumGrade = null;
    Offering.prototype._services = null;
    Offering.prototype._sessions = null;
    Offering.prototype._organization = null;
    Offering.prototype._site = null;
    Offering.prototype._sessionsPromise = null;
	
	Offering.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering/{0}'.format(this.id());
	}
	
	Offering.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	
	Offering.prototype.minimumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumAge;
		else
		{
		    if (newValue != this._minimumAge)
		    {
				this._minimumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumAge = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumAge;
		else
		{
		    if (newValue != this._maximumAge)
		    {
				this._maximumAge = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.minimumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._minimumGrade;
		else
		{
		    if (newValue != this._minimumGrade)
		    {
				this._minimumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.maximumGrade = function(newValue)
	{
		if (newValue === undefined)
			return this._maximumGrade;
		else
		{
		    if (newValue != this._maximumGrade)
		    {
				this._maximumGrade = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.offeringServices = function(newValue)
	{
		if (newValue === undefined)
			return this._services;
		else
		{
		    if (newValue != this._services)
		    {
				this._services = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.sessions = function(newValue)
	{
		if (newValue === undefined)
			return this._sessions;
		else
		{
		    if (newValue != this._sessions)
		    {
				this._sessions = newValue;
			}
			return this;
		}
	}
	
	Offering.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	Offering.prototype.site = cr.SiteLinkInstance.prototype.site;

    Offering.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['names', 'services'];
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
	Offering.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setNames(d, cr.OfferingName);

		this._webSite = 'web site' in d ? d['web site'] : "";
		this._minimumAge = 'minimum age' in d ? d['minimum age'] : "";
		this._maximumAge = 'maximum age' in d ? d['maximum age'] : "";
		this._minimumGrade = 'minimum grade' in d ? d['minimum grade'] : "";
		this._maximumGrade = 'maximum grade' in d ? d['maximum grade'] : "";
		this.setChildren(d, 'services', cr.OfferingService, this.offeringServices);
		this.setChildren(d, 'sessions', cr.Session, this.sessions);

		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
		cr.SiteLinkInstance.prototype.setData.call(this, d);
    }
    
    /** Merge the contents of the specified source into this Offering for
    	values that are not specified herein.
     */
	Offering.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._minimumAge) this._minimumAge = source._minimumAge;
		if (!this._maximumAge) this._maximumAge = source._maximumAge;
		if (!this._minimumGrade) this._minimumGrade = source._minimumGrade;
		if (!this._maximumGrade) this._maximumGrade = source._maximumGrade;
		if (!this._services && source._services)
			this._services = source._services;
		if (!this._sessions && source._sessions)
			this._sessions = source._sessions;
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		cr.SiteLinkInstance.prototype.mergeData.call(this, source);
		return this;
	}
	
	/** For a newly created Offering, set its contents to valid values. */
	Offering.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._names = [];
		this._webSite = "";
		this._minimumAge = "";
		this._maximumAge = "";
		this._minimumGrade = "";
		this._maximumGrade = "";
		this._services = [];
		this._sessions = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For offerings, sessions are not copied.
	 */
	Offering.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
		
		newInstance._webSite = this._webSite;
		newInstance._minimumAge = this._minimumAge;
		newInstance._maximumAge = this._maximumAge;
		newInstance._minimumGrade = this._minimumGrade;
		newInstance._maximumGrade = this._maximumGrade;
		newInstance._services = this.duplicateList(this._services, duplicateForEdit);

		if (duplicateForEdit)
		{
			if (this._sessions)
				newInstance._sessions = this.duplicateList(this._sessions);
		}
		
		return this;
	}
	
	Offering.prototype.appendData = function(initialData)
	{
		if (this.webSite())
			initialData['web site'] = this.webSite();
		if (this.minimumAge())
			initialData['minimum age'] = this.minimumAge();
		if (this.maximumAge())
			initialData['maximum age'] = this.maximumAge();
		if (this.minimumGrade())
			initialData['minimum grade'] = this.minimumGrade();
		if (this.maximumGrade())
			initialData['maximum grade'] = this.maximumGrade();
		
		this.appendList(this.names(), initialData, 'names');
		this.appendList(this.offeringServices(), initialData, 'services');
		this.appendList(this.sessions(), initialData, 'sessions');
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Offering.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.webSite(), revision.webSite()))
			changes['web site'] = revision.webSite();
		if (cr.stringChanged(this.minimumAge(), revision.minimumAge()))
			changes['minimum age'] = revision.minimumAge();
		if (cr.stringChanged(this.maximumAge(), revision.maximumAge()))
			changes['maximum age'] = revision.maximumAge();
		if (cr.stringChanged(this.minimumGrade(), revision.minimumGrade()))
			changes['minimum grade'] = revision.minimumGrade();
		if (cr.stringChanged(this.maximumGrade(), revision.maximumGrade()))
			changes['maximum grade'] = revision.maximumGrade();
		
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		
		this.appendUpdateList(this.offeringServices(), revision.offeringServices(), changes, 'services');		
					
		return changes;
	}
	
	/** For a newly updated item, add any new elements created to this. */
	Offering.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.names(), source.names())
				   .pullNewElements(this.offeringServices(), source.offeringServices());
	}
	
	/** Called after the contents of the Offering have been updated on the server. */
	Offering.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (this.updateNames(d, newIDs))
			changed = true;
		
		if ('web site' in d)
		{
			this._city = d['web site'];
			changed = true;
		}
		if ('minimum age' in d)
		{
			this._minimumAge = d['minimum age'];
			changed = true;
		}
		if ('maximum age' in d)
		{
			this._maximumAge = d['maximum age'];
			changed = true;
		}
		if ('minimum grade' in d)
		{
			this._minimumGrade = d['minimum grade'];
			changed = true;
		}
		if ('maximum grade' in d)
		{
			this._maximumGrade = d['maximum grade'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		if ('services' in d)
		{
			if (this.updateList(this.offeringServices, d['services'], newIDs, 'offeringServiceAdded.cr'))
				changed = true;
		}
		if ('sessions' in d)
		{
			if (this.updateList(this.sessions, d['sessions'], newIDs, 'sessionAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
	Offering.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().offerings(), this);
		$(this.parent()).trigger("offeringDeleted.cr", this);
	}
	
	Offering.prototype.ageRange = function()
	{
		var min = this.minimumAge();
		var max = this.maximumAge();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or older";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

	Offering.prototype.gradeRange = function()
	{
		var min = this.minimumGrade();
		var max = this.maximumGrade();
		if (min)
		{
			if (max)
			{
				if (min == max)
					return min;
				else
					return min + " - " + max;
			}
			else
				return min + " or beyond";
		}
		else if (max)
		{
			return "up to " + max;
		}
		else
			return "";
	}

    Offering.prototype.promiseSessions = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._sessionsPromise)
        	return this._sessionsPromise;
        else if (this._sessions)
        {
        	result = $.Deferred();
        	result.resolve(this._sessions);
        	return result;
        }
        
        var _this = this;	
        this._sessionsPromise = cr.getData(
        	{
        		path: this.urlPath() + "/session",
        		fields: ['parents'],
        		resultType: cr.Session
        	})
        	.then(function(sessions)
        		{
        			_this._sessions = sessions;
        			result = $.Deferred();
        			result.resolve(sessions);
        			return result;
        		});
        return this._sessionsPromise;
    }
    
	function Offering() {
	    cr.IInstance.call(this);
	};
	
	return Offering;

})();
	
cr.OfferingName = (function() {
	OfferingName.prototype = Object.create(cr.Name.prototype);
	OfferingName.prototype.constructor = OfferingName;
	
	OfferingName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering name/{0}'.format(this.id());
	}
	
	function OfferingName() {
	    cr.Name.call(this);
	};
	
	return OfferingName;

})();
	
cr.OfferingService = (function() {
	OfferingService.prototype = Object.create(cr.OrderedServiceLinkInstance.prototype);
	OfferingService.prototype.constructor = OfferingService;
	
	OfferingService.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'offering service/{0}'.format(this.id());
	}
	
	OfferingService.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().offeringServices(), this);
		$(this.parent()).trigger("offeringServiceDeleted.cr", this);
	}
	
	function OfferingService() {
	    cr.OrderedServiceLinkInstance.call(this);
	};
	
	return OfferingService;

})();
	
cr.Organization = (function() {
	Organization.prototype = Object.create(cr.PublicGrantable.prototype);
	Object.assign(Organization.prototype, cr.NamedInstance.prototype);
	Organization.prototype.constructor = Organization;

	Organization.prototype._webSite = null;
	Organization.prototype._inquiryAccessGroup = null;
	Organization.prototype._names = null;
	Organization.prototype._groups = null;
	Organization.prototype._sites = null;
	
	Organization.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	
	Organization.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization/{0}'.format(this.id());
	}
	
	Organization.prototype.inquiryAccessGroup = function(newValue)
	{
		if (newValue === undefined)
			return this._inquiryAccessGroup;
		else
		{
		    if (newValue != this._inquiryAccessGroup)
		    {
				this._inquiryAccessGroup = newValue;
			}
			return this;
		}
	}
	

	Organization.prototype.groups = function(newValue)
	{
		if (newValue === undefined)
			return this._groups;
		else
		{
		    if (newValue != this._groups)
		    {
				this._groups = newValue;
			}
			return this;
		}
	}
	
	Organization.prototype.userGrantType = function()
	{
		return cr.OrganizationUserGrant;
	}
	
	Organization.prototype.groupGrantType = function()
	{
		return cr.OrganizationGroupGrant;
	}
	
	Organization.prototype.sites = function(newValue)
	{
		if (newValue === undefined)
			return this._sites;
		else
		{
		    if (newValue != this._sites)
		    {
				this._sites = newValue;
			}
			return this;
		}
	}
	
	Organization.prototype.setDefaultValues = function()
	{
		cr.PublicGrantable.prototype.setDefaultValues.call(this);
		this._webSite = "";
		this._names = [];
		this._groups = [];
		this._sites = [];
		this._inquiryAccessGroup = null;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	Organization.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.PublicGrantable.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
		
		newInstance._webSite = this._webSite;
		newInstance._inquiryAccessGroup = this._inquiryAccessGroup;

		if (duplicateForEdit)
		{
			if (this._sites)
				newInstance._sites = this.duplicateList(this._sites);
			if (this._groups)
				newInstance._groups = this.duplicateList(this._groups);
		}
		
		return this;
	}
	
	Organization.prototype.appendData = function(initialData)
	{
		cr.PublicGrantable.prototype.appendData.call(this, initialData);
		if (this.webSite())
			initialData['web site'] = this.webSite();
		
		this.appendList(this.names(), initialData, 'names');
		this.appendList(this.groups(), initialData, 'groups');
		
		if (this.inquiryAccessGroup())
			initialData['inquiry access group'] = 'group/' + this.inquiryAccessGroup().clientID();
		
		this.appendList(this.sites(), initialData, 'sites');
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Organization.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.PublicGrantable.prototype.appendChanges.call(this, revision, changes);
		
		if (cr.stringChanged(this.webSite(), revision.webSite()))
			changes['web site'] = revision.webSite();
				
		if (cr.linkChanged(this.inquiryAccessGroup(), revision.inquiryAccessGroup()))
			changes['inquiry access group'] = revision.inquiryAccessGroup() && revision.inquiryAccessGroup().urlPath();
		
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		
					
		return changes;
	}
	
	/** Sets the data for this Organization based on a dictionary of data that
		came from the server.
	 */
	Organization.prototype.setData = function(d)
	{
		cr.PublicGrantable.prototype.setData.call(this, d);
		this.setNames(d, cr.OrganizationName);

		this._webSite = 'web site' in d ? d['web site'] : "";

		this.setChildren(d, 'groups', cr.Group, this.groups);
		this.setChildren(d, 'sites', cr.Site, this.sites);

		if ('inquiry access group' in d && 
			'id' in d['inquiry access group'] &&
			this._groups)
			this._inquiryAccessGroup = crp.getInstance(d['inquiry access group']['id']);
    }
    
    /** Merge the contents of the specified source into this Organization for
    	values that are not specified herein.
     */
	Organization.prototype.mergeData = function(source)
	{
		cr.PublicGrantable.prototype.mergeData.call(this, source);
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._groups && source._groups)
			this._groups = source._groups;
		if (!this._sites && source._sites)
			this._sites = source._sites;
		if (!this._inquiryAccessGroup && source._inquiryAccessGroup && this._groups)
		{
			this._inquiryAccessGroup = this._groups.find(function(group)
				{
					return group.id() == source._inquiryAccessGroup.id();
				});
		}
		return this;
	}
	
	/** For a newly created Organization, set its contents to valid values. */
	Organization.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.names(), source.names());
	}
	
	/** Called after the contents of the Organization have been updated on the server. */
	Organization.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.PublicGrantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
			
		if ('web site' in d)
		{
			this._webSite = d['web site'];
			changed = true;
		}
		
		if (this.updateNames(d, newIDs))
			changed = true;

		if (changed)
			this.triggerChanged();
			
		if ('groups' in d)
		{
			if (this.updateList(this.groups, d['groups'], newIDs, 'groupAdded.cr'))
				changed = true;
		}
		if ('sites' in d)
		{
			if (this.updateList(this.sites, d['sites'], newIDs, 'siteAdded.cr'))
				changed = true;
		}
		if ('inquiry access group' in d)
		{
			var idData = d['inquiry access group'];
			var id;
			if (!idData)
				this._inquiryAccessGroup = null;
			else
			{
				if (typeof(idData) == 'string')
				{
					console.assert(/^group\/[A-Za-z0-9]{32}$/.test(idData));
					id = idData.substring('group/'.length);
				}
				else
					id = idData['id'];
				this._inquiryAccessGroup = this.groups().find(function(group)
					{
						return group.id() == id;
					});
			}
			changed = true;
		}
		
		return changed;
	}
	
    Organization.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['sites', 'groups'];
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
    Organization.prototype.getData = function(fields)
    {
    	var _this = this;
    	return cr.IInstance.prototype.getData.call(this, fields)
        	.then(function()
        	{
        		if (_this.sites())
        		{
					_this.sites().forEach(function(site)
						{
							site.organization(_this);
						});
        		}
        		return _this;
        	});
    }
    
	function Organization() {
	    cr.PublicGrantable.call(this);
	};
	
	return Organization;

})();
	
cr.OrganizationName = (function() {
	OrganizationName.prototype = Object.create(cr.Name.prototype);
	OrganizationName.prototype.constructor = OrganizationName;
	
	OrganizationName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization name/{0}'.format(this.id());
	}
	
	function OrganizationName() {
	    cr.Name.call(this);
	};
	
	return OrganizationName;

})();
	
cr.OrganizationUserGrant = (function() {
	OrganizationUserGrant.prototype = Object.create(cr.UserGrant.prototype);
	OrganizationUserGrant.prototype.constructor = OrganizationUserGrant;

	OrganizationUserGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization user grant/{0}'.format(this.id());
	}
	
	function OrganizationUserGrant() {
	    cr.UserGrant.call(this);
	};
	
	return OrganizationUserGrant;

})();
	
cr.OrganizationGroupGrant = (function() {
	OrganizationGroupGrant.prototype = Object.create(cr.GroupGrant.prototype);
	OrganizationGroupGrant.prototype.constructor = OrganizationGroupGrant;

	OrganizationGroupGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'organization group grant/{0}'.format(this.id());
	}
	
	function OrganizationGroupGrant() {
	    cr.GroupGrant.call(this);
	};
	
	return OrganizationGroupGrant;

})();
	
var AgeCalculator = (function() {
	AgeCalculator.prototype.birthdays = null;
	
	AgeCalculator.prototype.getBirthday = function()
	{
		return this.birthdays[0];
	}
	
	AgeCalculator.prototype.getAge = function(dateString)
	{
		return new Date(dateString) - this.birthdays[0];
	}
	
	AgeCalculator.prototype.getYears = function(dateString)
	{
		var d = new Date(dateString);
		var min = 0;
		var range = this.birthdays.length - 1;
		var mid;
		while (true)
		{
			if (min > range)
			{
				if (min < this.birthdays.length)
					return min - 1;
					
				// Extend the birthday list until it overruns the searched for date.
				while (d > this.birthdays[this.birthdays.length - 1])
				{
					var bd = new Date(this.birthdays[0].valueOf());
					bd.setUTCFullYear(this.birthdays[0].getUTCFullYear() + this.birthdays.length)
					this.birthdays.push(bd);
				}
				return this.birthdays.length - 2;
			}

			mid = Math.floor((min + range) / 2);
			if (this.birthdays[mid] < d)
				min = mid + 1;
			else if (this.birthdays[mid] > d)
				range = mid - 1;
			else
				return mid;
		}
	}
	
	AgeCalculator.prototype.toString = function()
	{
		return "{0}-year-old".format(this.getYears(new Date().toISOString().substr(0, 10)));
	}
	
	function AgeCalculator(s)
	{
		var d = new Date(s);
		this.birthdays = [d];
	}
	
	return AgeCalculator;
})();

cr.Path = (function() {
	Path.prototype = Object.create(cr.PublicGrantable.prototype);
	Path.prototype.constructor = Path;

	Path.prototype._birthday = null;
	Path.prototype._name = null;
	Path.prototype._specialAccess = null;
	Path.prototype._canAnswerExperience = null;
	Path.prototype._experiences = null;
	Path.prototype._engagements = null;
	Path.prototype._experiencesPromise = null;
	Path.prototype._user = null;
	Path.prototype._userPromise = null;
	Path.prototype.someoneString = "Someone";
	
	Path.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'path/{0}'.format(this.id());
	}
	
	Path.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.name = function(newValue)
	{
		if (newValue === undefined)
			return this._name;
		else
		{
		    if (newValue != this._name)
		    {
				this._name = newValue;
			}
			return this;
		}
	}
	
/**
 * Returns a string that describes the user associated with the specified path.
 * The string may be either the name of the user associated with the path (if defined
 * and accessible), the screen name associated with the path, the email address
 * associated with the user associated with the path (if defined and accessible) or
 * "Someone" (or some translation thereof)
 */
	Path.prototype.caption = function()
	{
		return (this.user() && this.user().fullName()) ||
				this.name() ||
			   (this.user() && this.user().description()) ||
			   (this.birthday() && (new AgeCalculator(this.birthday())).toString()) ||
				this.someoneString;
	}
	
	Path.prototype.specialAccess = function(newValue)
	{
		if (newValue === undefined)
			return this._specialAccess;
		else
		{
		    if (newValue != this._specialAccess)
		    {
				this._specialAccess = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.canAnswerExperience = function(newValue)
	{
		if (newValue === undefined)
			return this._canAnswerExperience;
		else
		{
		    if (newValue != this._canAnswerExperience)
		    {
				this._canAnswerExperience = newValue;
			}
			return this;
		}
	}
	
	Path.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
		    if (newValue != this._user)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
    Path.prototype.promiseUser = function()
    {
    	/* If we only have find privileges, then just let the child deal with this. */
		if (this.privilege() == cr.privileges.find)
		{
			var result = $.Deferred();
			result.resolve();
			return result.promise();
		}

    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._userPromise)
        	return this._userPromise;
        else if (this._user)
        {
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
        }
        else if (this._parentID && crp.getInstance(this._parentID))
        {
        	this._user = crp.getInstance(this._parentID);
        	result = $.Deferred();
        	result.resolve(this._user);
        	return result;
		}
		        
        var _this = this;	
        this._userPromise = cr.getData(
        	{
        		path: this.urlPath() + '/user',
        		fields: [],
        		resultType: cr.User
        	})
        	.then(function(users)
        		{
        			var user = users[0];
        			_this._user = user;
        			user.path(_this);
        			result = $.Deferred();
        			result.resolve(user);
        			return result;
        		});
        return this._userPromise;
    }
    
	Path.prototype.setData = function(d)
	{
		cr.PublicGrantable.prototype.setData.call(this, d);
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._name = 'name' in d ? d['name'] : "";
		this._specialAccess = 'special access' in d ? d['special access'] : "";
		this._canAnswerExperience = 'can answer experience' in d ? d['can answer experience'] : "";
		
		this.setChildren(d, 'experiences', cr.Experience, this.experiences);
		if ('experiences' in d)
		{
			var _this = this;
			this._experiences.forEach(function(e) { e.path(_this); });
		}
		if ('user' in d)
		{
			/* Create a user and push its info. The pushInstance (instead of
				getInstance) is needed if this path is the asker of a comment.
			 */
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
    }
    
    /** Merge the contents of the specified source into this Path for
    	values that are not specified herein.
     */
	Path.prototype.mergeData = function(source)
	{
		cr.PublicGrantable.prototype.mergeData.call(this, source);
		if (this._name === null) this._name = source._name;
		if (!this._experiences) 
		{
			this._experiences = source._experiences;
			var _this = this;
			if (this._experiences)
				this._experiences.forEach(function(e) { e.path(_this); });
		}
		if (!this._user) this._user = source._user;
		return this;
	}
	
	Path.prototype.setDefaultValues = function()
	{
		cr.PublicGrantable.prototype.setDefaultValues.call(this);
		this._experiences = [];
		this._engagements = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
	 */
	Path.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.PublicGrantable.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		newInstance._name = this._name;
		newInstance._specialAccess = this._specialAccess;
		newInstance._canAnswerExperience = this._canAnswerExperience;
		
		if (duplicateForEdit)
		{
			if (this._experiences)
				newInstance._experiences = this.duplicateList(this._experiences);
		}
		
		return this;
	}
	
	/* Appends to initialData all of the operations needed to create a new
		instance.
	 */
	Path.prototype.appendData = function(initialData)
	{
		cr.PublicGrantable.prototype.appendData.call(this, initialData);
		this.appendList(this.experiences(), initialData, 'experiences');
	}
	
	/* Appends to changes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Path.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.PublicGrantable.prototype.appendChanges.call(this, revision, changes);
		
		if (cr.stringChanged(this.name(), revision.name()))
			changes['screen name'] = revision.name();
		if (cr.stringChanged(this.specialAccess(), revision.specialAccess()))
			changes['special access'] = revision.specialAccess();
		if (cr.stringChanged(this.canAnswerExperience(), revision.canAnswerExperience()))
			changes['can answer experience'] = revision.canAnswerExperience();
		
		return changes;
	}
	
	Path.prototype.calculateDescription = function()
	{
		this.description(this._name);
	}
	
	/** Called after the contents of the Path have been updated on the server. */
	Path.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.PublicGrantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
		
		if ('screen name' in d)
		{
			this._name = d['screen name'];
			changed = true;
		}
		if ('special access' in d)
		{
			this._specialAccess = d['special access'];
			changed = true;
		}
		if ('can answer experience' in d)
		{
			this._canAnswerExperience = d['can answer experience'];
			changed = true;
		}

		if (changed)
			this.triggerChanged();
		
		if ('experiences' in d)
		{
			if (this.updateList(this.experiences, d['experiences'], newIDs, 'experienceAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
    Path.prototype.experiences = function(newValue)
    {
    	if (newValue === undefined)
    	{
    		if (this._experiences === null)
    			throw new Error("Runtime Error: experiences of a path have not been set");
    		else
    			return this._experiences;
    	}
    	else
    	{
    		this._experiences = newValue;
    	}
    }
    
    Path.prototype.engagements = function(newValue)
    {
    	if (newValue === undefined)
    	{
    		if (this._engagements === null)
    			throw new Error("Runtime Error: engagements of a path have not been set");
    		else
    			return this._engagements;
    	}
    	else
    	{
    		this._engagements = newValue;
    	}
    }
    
    Path.prototype.promiseExperiences = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._experiencesPromise)
        	return this._experiencesPromise;
        else if (this._experiences)
        {
        	result = $.Deferred();
        	result.resolve(this._experiences);
        	return result;
        }
        
        var _this = this;	
        this._experiencesPromise = 	
        	cr.getData({path: _this.urlPath() + '/experience/offering',
			                        fields: ['services'],
			                        resultType: cr.Offering})
			.then(function() {
				return cr.getData({path: _this.urlPath() + '/experience',
								   fields: ['services', 'custom services'],
								   resultType: cr.Experience
					});
				})
			.then(function(experiences)
        		{
        			_this._experiences = experiences;
        			experiences.forEach(function(e)
        				{
        					e.parent(_this)
        					 .path(_this);
        					e.calculateDescription();
        				});
        			
        			result = $.Deferred();
        			result.resolve(experiences);
        			return result;
        		});
        return this._experiencesPromise;
    }
    
	function Path() {
	    cr.PublicGrantable.call(this);
	};
	
	return Path;

})();
	
cr.Period = (function() {
	Period.prototype = Object.create(cr.IInstance.prototype);
	Period.prototype.constructor = Period;

    Period.prototype._weekday = null;
    Period.prototype._startTime = null;
    Period.prototype._endTime = null;
	
	Period.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'period/{0}'.format(this.id());
	}
	
	Period.prototype.weekday = function(newValue)
	{
		if (newValue === undefined)
			return this._weekday;
		else
		{
		    if (newValue != this._weekday)
		    {
				this._weekday = newValue;
			}
			return this;
		}
	}
	
	Period.prototype.startTime = function(newValue)
	{
		if (newValue === undefined)
			return this._startTime;
		else
		{
		    if (newValue != this._startTime)
		    {
				this._startTime = newValue;
			}
			return this;
		}
	}
	
	Period.prototype.endTime = function(newValue)
	{
		if (newValue === undefined)
			return this._endTime;
		else
		{
		    if (newValue != this._endTime)
		    {
				this._endTime = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this Period based on a dictionary of data that
		came from the server.
	 */
	Period.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._weekday = 'weekday' in d ? d['weekday'] : "";
		this._startTime = 'start time' in d ? d['start time'] : "";
		this._endTime = 'end time' in d ? d['end time'] : "";
    }
    
    /** Merge the contents of the specified source into this Period for
    	values that are not specified herein.
     */
	Period.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (this._weekday === null) this._weekday = source._weekday;
		if (!this._startTime) this._startTime = source._startTime;
		if (!this._endTime) this._endTime = source._endTime;
		return this;
	}
	
	/** For a newly created Period, set its contents to valid values. */
	Period.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._weekday = "";
		this._startTime = "";
		this._endTime = "";
	}
	
	Period.prototype.weekdayDescription = function()
	{
		return this._weekday == null ? "any day" :
			Date.CultureInfo.dayNames[parseInt(this._weekday)];
	}
	
	Period.prototype.appendData = function(initialData)
	{
		if (this.weekday() != null)
			initialData['weekday'] = this.weekday();
		if (this.startTime() != null)
			initialData['start time'] = this.getISOTime(this.startTime());
		if (this.endTime() != null)
			initialData['end time'] = this.getISOTime(this.endTime());
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	Period.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._weekday = this._weekday;
		newInstance._startTime = this._startTime;
		newInstance._endTime = this._endTime;
		
		return this;
	}
	
	Period.prototype.getISOTime = function(newValue)
	{
		if (!newValue)
			return "";
		else
			return Date.parse(newValue).toString("HH:mm");
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Period.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.weekday(), revision.weekday()))
			changes['weekday'] = revision.weekday();
		
		var newValue = this.getISOTime(revision.startTime());
		if (cr.stringChanged(this.startTime(), newValue))
			changes['start time'] = newValue;

		newValue = this.getISOTime(revision.endTime());
		if (cr.stringChanged(this.endTime(), newValue))
			changes['end time'] = newValue;
		
		return changes;
	}
	
	Period.prototype.calculateDescription = function()
	{
		this.description("{0}: {1}-{2}".format(
					this.weekdayDescription(),
					this._startTime,
					this._endTime
				));

	}
	
	/** Called after the contents of the Period have been updated on the server. */
	Period.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		var changed = false;
		if ('weekday' in d)
		{
			this._weekday = d['weekday'];
			changed = true;
		}
		if ('start time' in d)
		{
			this._startTime = d['start time'];
			changed = true;
		}
		if ('end time' in d)
		{
			this._endTime = d['end time'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
		
		return changed;
	}
	
	Period.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().periods(), this);
		$(this.parent()).trigger("periodDeleted.cr", this);
	}
	
	function Period() {
	    cr.IInstance.call(this);
	};
	
	return Period;

})();
	
cr.Service = (function() {
	Service.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Service.prototype, cr.NamedInstance.prototype);
	Service.prototype.constructor = Service;

	Service.prototype._stage = null;
	Service.prototype._names = null;
	Service.prototype._organizationLabels = null;
	Service.prototype._siteLabels = null;
	Service.prototype._offeringLabels = null;
	Service.prototype._serviceImplications = null;
	Service.prototype._impliedBy = null;
	Service.prototype._impliedDirectlyBy = null;
	
	Service.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service/{0}'.format(this.id());
	}
	
	Service.prototype.stage = function(newValue)
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
	
	Service.prototype.organizationLabels = function(newData)
	{
		if (newData === undefined)
			return this._organizationLabels;
		else
		{
			this._organizationLabels = newData;
			return this;
		}
	}
	
	Service.prototype.siteLabels = function(newData)
	{
		if (newData === undefined)
			return this._siteLabels;
		else
		{
			this._siteLabels = newData;
			return this;
		}
	}
	
	Service.prototype.offeringLabels = function(newData)
	{
		if (newData === undefined)
			return this._offeringLabels;
		else
		{
			this._offeringLabels = newData;
			return this;
		}
	}
	
	Service.prototype.serviceImplications = function(newData)
	{
		if (newData === undefined)
			return this._serviceImplications;
		else
		{
			this._serviceImplications = newData;
			return this;
		}
	}
	
	Service.prototype.impliedDirectlyBy = function()
	{
		return this._impliedDirectlyBy;
	}
	
	Service.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setNames(d, cr.ServiceName);

		this._stage = 'stage' in d ? d['stage'] : "";

		this.setChildren(d, 'organization labels', cr.ServiceOrganizationLabel, this.organizationLabels);
		this.setChildren(d, 'site labels', cr.ServiceSiteLabel, this.siteLabels);
		this.setChildren(d, 'offering labels', cr.ServiceOfferingLabel, this.offeringLabels);
		this.setChildren(d, 'services', cr.ServiceImplication, this.serviceImplications);
	}
	
    /** Merge the contents of the specified source into this Street for
    	values that are not specified herein.
     */
	Service.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._stage) this._stage = source._stage;
		if (!this._organizationLabels && source._organizationLabels)
			this._organizationLabels = source._organizationLabels;
		if (!this._siteLabels && source._siteLabels)
			this._siteLabels = source._siteLabels;
		if (!this._offeringLabels && source._offeringLabels)
			this._offeringLabels = source._offeringLabels;
		if (!this._serviceImplications && source._serviceImplications)
			this._serviceImplications = source._serviceImplications;
		
		return this;
	}
	
	/** For a newly created Period, set its contents to valid values. */
	Service.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._stage = "";
		this._names = [];
		this._organizationLabels = [];
		this._siteLabels = [];
		this._offeringLabels = [];
		this._serviceImplications = [];
	}
	
	Service.prototype.appendData = function(initialData)
	{
		if (this.stage() != null)
			initialData['stage'] = this.stage();
			
		this.appendList(this.names(), initialData, 'names');
		this.appendList(this.organizationLabels(), initialData, 'organization labels');
		this.appendList(this.siteLabels(), initialData, 'site labels');
		this.appendList(this.offeringLabels(), initialData, 'offering labels');
		this.appendList(this.serviceImplications(), initialData, 'services');
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	Service.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
		
		newInstance._stage = this._stage;
		newInstance._organizationLabels = this.duplicateList(this._organizationLabels, duplicateForEdit);
		newInstance._siteLabels = this.duplicateList(this._siteLabels, duplicateForEdit);
		newInstance._offeringLabels = this.duplicateList(this._offeringLabels, duplicateForEdit);
		newInstance._serviceImplications = this.duplicateList(this._serviceImplications, duplicateForEdit);
		
		return this;
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Service.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.stage(), revision.stage()))
			changes['stage'] = revision.stage();
		
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		
		this.appendUpdateList(this.organizationLabels(), revision.organizationLabels(), changes, 'organization labels');		
		this.appendUpdateList(this.siteLabels(), revision.siteLabels(), changes, 'site labels');		
		this.appendUpdateList(this.offeringLabels(), revision.offeringLabels(), changes, 'offering labels');		
		this.appendUpdateList(this.serviceImplications(), revision.serviceImplications(), changes, 'services');		

		return changes;
	}
	
	/** For a newly updated item, add any new elements created to this. */
	Service.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.names(), source.names())
				   .pullNewElements(this.organizationLabels(), source.organizationLabels())
				   .pullNewElements(this.siteLabels(), source.siteLabels())
				   .pullNewElements(this.offeringLabels(), source.offeringLabels())
				   .pullNewElements(this.serviceImplications(), source.serviceImplications());
	}
	
	/** Called after the contents of the Service have been updated on the server. */
    Service.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['services'];
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
	Service.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
			
		if (this.updateNames(d, newIDs))
			changed = true;

		if ('stage' in d)
		{
			this._stage = d['stage'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		if ('organization labels' in d)
		{
			if (this.updateList(this.organizationLabels, d['organization labels'], newIDs, 'organizationLabelAdded.cr'))
				changed = true;
		}
		if ('site labels' in d)
		{
			if (this.updateList(this.siteLabels, d['site labels'], newIDs, 'siteLabelAdded.cr'))
				changed = true;
		}
		if ('offering labels' in d)
		{
			if (this.updateList(this.offeringLabels, d['offering labels'], newIDs, 'offeringLabelAdded.cr'))
				changed = true;
		}
		if ('services' in d)
		{
			if (this.updateList(this.serviceImplications, d['services'], newIDs, 'implicationAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
    Service.servicesPromise = function()
    {
        if (cr.Service._servicesPromise)
        	return cr.Service._servicesPromise;
        
        cr.Service._servicesPromise = cr.getData(
        	{
        		path: 'service',
        		fields: ['services'],
        		resultType: cr.Service
        	})
        	.done(function(services)
        		{
        			services.forEach(function(s)
        				{
        					s.serviceImplications().forEach(function(si)
        						{
        							var s2 = si.service();
        							if (s2 != s)
        							{
										s2._impliedBy.push(s);
										s2._impliedDirectlyBy.push(s);
        							}
        						});
        				});
        			services.forEach(function(s)
        				{
        					for (var i = 0; i < s._impliedBy.length - 1; ++i)
        					{
        						var s2 = s._impliedBy[i];
        						var removedS2 = false;
        						for (var j = i + 1; j < s._impliedBy.length; ++j)
        						{
        							var s3 = s._impliedBy[j];
        							if (s2._impliedBy.indexOf(s3) >= 0)
        								cr.removeElement(s._impliedDirectlyBy, s3);
        							else if (!removedS2 && s3._impliedBy.indexOf(s2) >= 0)
        							{
        								cr.removeElement(s._impliedDirectlyBy, s2);
        								removedS2 = true;
        							}
        						}
        					}
        				});
        				
        			result = $.Deferred();
        			result.resolve(services);
        			return result;
        		});
        return cr.Service._servicesPromise;
    }
    
	Service.stageColumns = {
		Housing: 0,
		Studying: 1,
		Certificate: 1,
		Training: 2,
		Whatever: 2,
		Working: 3,
		Teaching: 3,
		Expert: 3,
		Skills: 4,
		Award: 4,
		Mentoring: 5,
		Tutoring: 5,
		Coaching: 5,
		Volunteering: 5,
		Wellness: 6,
	};
	
	Service.prototype.getStageDescription = function(stage)
	{
		return stage in cr.Service.stageColumns && stage;
	}
	
	Service.prototype.getColumn = function()
	{
		var stage = this.stage();
		var stageDescription = this.getStageDescription(stage);
		if (stageDescription)
			return cr.Service.stageColumns[stageDescription];
		var _this = this;
			
		if (this.id())
		{
			var services = this.serviceImplications();
			/* services may be null if the service has been deleted */
			var s = services && services.map(function(s)
				{
					return s.service();
				})
				.find(function(s)
				{
					var stage =  s.stage();
					return s.getStageDescription(stage);
				});
			if (s)
				return cr.Service.stageColumns[
					s.getStageDescription(s.stage())
				];
		}

		/* Other */
		return 7;
	}
	
	Service.prototype.getColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].color;
	}
	
	Service.prototype.fontColor = function()
	{
		var column = this.getColumn();
		return PathGuides.data[column].fontColor;
	}
	
	/* Returns True if the service contains the specified text. */
	Service.prototype.descriptionContains = function(s, prefix, service)
	{
		if (service)
		{
			return this == service || service.impliedDirectlyBy().indexOf(this) >= 0;
		}
		else
		{
			var re = new RegExp(prefix + s.replace(/([\.\\\/\^\+])/, "\\$1"), "i");
			return re.test(this.description());
		}
	}
	
	function Service() {
	    cr.IInstance.call(this);
	    this._impliedBy = [];
	    this._impliedDirectlyBy = [];
	};
	
	return Service;

})();
cr.Service._servicesPromise = null;
	
cr.Service.clearPromises = function()
{
	cr.Service._servicesPromise = null;
}

cr.ServiceName = (function() {
	ServiceName.prototype = Object.create(cr.Name.prototype);
	ServiceName.prototype.constructor = ServiceName;
	
	ServiceName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service name/{0}'.format(this.id());
	}
	
	function ServiceName() {
	    cr.Name.call(this);
	};
	
	return ServiceName;

})();
	
cr.ServiceOrganizationLabel = (function() {
	ServiceOrganizationLabel.prototype = Object.create(cr.TranslationInstance.prototype);
	ServiceOrganizationLabel.prototype.constructor = ServiceOrganizationLabel;
	
	ServiceOrganizationLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service organization label/{0}'.format(this.id());
	}
	
	ServiceOrganizationLabel.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().organizationLabels(), this);
	}
	
	function ServiceOrganizationLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOrganizationLabel;

})();
	
cr.ServiceSiteLabel = (function() {
	ServiceSiteLabel.prototype = Object.create(cr.TranslationInstance.prototype);
	ServiceSiteLabel.prototype.constructor = ServiceSiteLabel;
	
	ServiceSiteLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service site label/{0}'.format(this.id());
	}
	
	ServiceSiteLabel.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().siteLabels(), this);
	}
	
	function ServiceSiteLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceSiteLabel;

})();
	
cr.ServiceOfferingLabel = (function() {
	ServiceOfferingLabel.prototype = Object.create(cr.TranslationInstance.prototype);
	ServiceOfferingLabel.prototype.constructor = ServiceOfferingLabel;
	
	ServiceOfferingLabel.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service offering label/{0}'.format(this.id());
	}
	
	ServiceOfferingLabel.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().offeringLabels(), this);
	}
	
	function ServiceOfferingLabel() {
	    cr.TranslationInstance.call(this);
	};
	
	return ServiceOfferingLabel;

})();
	
cr.ServiceImplication = (function() {
	ServiceImplication.prototype = Object.create(cr.ServiceLinkInstance.prototype);
	ServiceImplication.prototype.constructor = ServiceImplication;
	
	ServiceImplication.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'service implication/{0}'.format(this.id());
	}
	
	ServiceImplication.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().serviceImplications(), this);
	}
	
	function ServiceImplication() {
	    cr.ServiceLinkInstance.call(this);
	};
	
	return ServiceImplication;

})();
	
cr.Session = (function() {
	Session.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Session.prototype, cr.NamedInstance.prototype);
	Object.assign(Session.prototype, cr.DateRangeInstance.prototype);
	Session.prototype.constructor = Session;
	
	Session.prototype._names = null;
	Session.prototype._registrationDeadline = null;
	Session.prototype._canRegister = null;
	Session.prototype._inquires = null;
	Session.prototype._enrollments = null;
	Session.prototype._engagements = null;
	Session.prototype._periods = null;
	Session.prototype._inquiriesPromise = null;
	Session.prototype._enrollmentsPromise = null;
	Session.prototype._engagementsPromise = null;
	Session.prototype._periodsPromise = null;
	Session.prototype._organization = null;
	Session.prototype._site = null;
	Session.prototype._offering = null;
	
	Session.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'session/{0}'.format(this.id());
	}
	
	Session.prototype.registrationDeadline = function(newValue)
	{
		if (newValue === undefined)
			return this._registrationDeadline;
		else
		{
		    if (newValue != this._registrationDeadline)
		    {
				this._registrationDeadline = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.canRegister = function(newValue)
	{
		if (newValue === undefined)
			return this._canRegister;
		else
		{
		    if (newValue != this._canRegister)
		    {
				this._canRegister = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.inquiries = function(newData)
	{
		if (newData === undefined)
			return this._inquiries;
		else
		{
			this._inquiries = newData;
			return this;
		}
	}
	
	Session.prototype.enrollments = function(newData)
	{
		if (newData === undefined)
			return this._enrollments;
		else
		{
			this._enrollments = newData;
			return this;
		}
	}
	
	Session.prototype.engagements = function(newData)
	{
		if (newData === undefined)
			return this._engagements;
		else
		{
			this._engagements = newData;
			return this;
		}
	}
	
	Session.prototype.periods = function(newData)
	{
		if (newData === undefined)
			return this._periods;
		else
		{
			this._periods = newData;
			return this;
		}
	}
	
	Session.prototype.offering = function(newValue)
	{
		if (newValue === undefined)
			return this._offering;
		else
		{
		    if (newValue != this._offering)
		    {
				this._offering = newValue;
				this.parent(newValue);
			}
			return this;
		}
	}
	
	Session.prototype.site = function(newValue)
	{
		if (newValue === undefined)
			return this._site;
		else
		{
		    if (newValue != this._site)
		    {
				this._site = newValue;
			}
			return this;
		}
	}
	
	Session.prototype.organization = function(newValue)
	{
		if (newValue === undefined)
			return this._organization;
		else
		{
		    if (newValue != this._organization)
		    {
				this._organization = newValue;
			}
			return this;
		}
	}
	
    Session.prototype.promiseInquiries = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._inquiriesPromise)
        	return this._inquiriesPromise;
        else if (this._inquiries)
        {
        	result = $.Deferred();
        	result.resolve(this._inquiries);
        	return result;
        }
        
        var _this = this;	
        this._inquiriesPromise = cr.getData(
        	{
        		path: 'session/{0}/inquiry'.format(this.id()),
        		fields: [],
        		resultType: cr.Inquiry
        	})
        	.then(function(inquiries)
        		{
        			_this._inquiries = inquiries;
        			_this._inquiries.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(inquiries);
        			return result;
        		});
        return this._inquiriesPromise;
    }
    
    Session.prototype.promiseEnrollments = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._enrollmentsPromise)
        	return this._enrollmentsPromise;
        else if (this._enrollments)
        {
        	result = $.Deferred();
        	result.resolve(this._enrollments);
        	return result;
        }
        
        var _this = this;	
        this._enrollmentsPromise = cr.getData(
        	{
        		path: 'session/{0}/enrollment'.format(this.id()),
        		fields: [],
        		resultType: cr.Enrollment
        	})
        	.then(function(enrollments)
        		{
        			_this._enrollments = enrollments;
        			_this._enrollments.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(enrollments);
        			return result;
        		});
        return this._enrollmentsPromise;
    }
    
    Session.prototype.promiseEngagements = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._engagementsPromise)
        	return this._engagementsPromise;
        else if (this._engagements)
        {
        	result = $.Deferred();
        	result.resolve(this._engagements);
        	return result;
        }
        
        var _this = this;	
        this._engagementsPromise = cr.getData(
        	{
        		path: 'session/{0}/engagement'.format(this.id()),
        		fields: [],
        		resultType: cr.Engagement
        	})
        	.then(function(engagements)
        		{
        			_this._engagements = engagements;
        			_this._engagements.forEach(function(e)
        				{
        					e.session(_this);
        				});
        			result = $.Deferred();
        			result.resolve(engagements);
        			return result;
        		});
        return this._engagementsPromise;
    }
    
	Session.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setDateRange(d);
		this.setNames(d, cr.SessionName);

		this._registrationDeadline = 'registration deadline' in d ? d['registration deadline'] : "";
		this._canRegister = 'can register' in d ? d['can register'] : "";
		
		this.setChildren(d, 'inquiries', cr.Inquiry, this.inquiries);
		this.setChildren(d, 'enrollments', cr.Enrollment, this.enrollments);
		this.setChildren(d, 'engagements', cr.Engagement, this.engagements);
		this.setChildren(d, 'periods', cr.Period, this.periods);

		if ('offering' in d)
		{
			this._offering = new cr.Offering();
			this._offering.setData(d['offering']);
			this._offering = crp.pushInstance(this._offering);
			this.parent(this._offering);
		}
		if ('site' in d)
		{
			this._site = new cr.Site();
			this._site.setData(d['site']);
			this._site = crp.pushInstance(this._site);
		}
		if ('organization' in d)
		{
			this._organization = new cr.Organization();
			this._organization.setData(d['organization']);
			this._organization = crp.pushInstance(this._organization);
		}
    }
    
	Session.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		this.mergeDateRange(source);
		if (!this._names && source._names)
			this._names = source._names;
		if (!this._registrationDeadline) this._registrationDeadline = source._registrationDeadline;
		if (!this._canRegister) this._canRegister = source._canRegister;
		if (!this._inquiries && source._inquiries)
			this._inquiries = source._inquiries;
		if (!this._enrollments && source._enrollments)
			this._enrollments = source._enrollments;
		if (!this._engagements && source._engagements)
			this._engagements = source._engagements;
		if (!this._periods && source._periods)
			this._periods = source._periods;
		if (!this.offering && source._offering)
		{
			this._offering = source._offering;
			this.parent(source._offering);
		}
		if (!this.site && source.site)
			this.site = source.site;
		if (!this._organization && source._organization)
			this._organization = source._organization;
		return this;
    }
    
	/** For a newly created Session, set its contents to valid values. */
	Session.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this.setDefaultDateRange();
		this._registrationDeadline = "";
		this._canRegister = 'no';
		this._names = [];
		this._inquiries = [];
		this._enrollments = [];
		this._engagements = [];
		this._periods = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For sessions, inquiries, enrollments, engagements and periods are not copied.
	 */
	Session.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
    	this.duplicateDateRange(newInstance);
		
		newInstance._registrationDeadline = this._registrationDeadline;
		newInstance._canRegister = this._canRegister;
		
		newInstance._offering = this._offering;
		newInstance._site = this._site;
		newInstance._organization = this._organization;

		if (duplicateForEdit)
		{
			if (this._inquiries)
				newInstance._inquiries = this.duplicateList(this._inquiries);
			if (this._enrollments)
				newInstance._enrollments = this.duplicateList(this._enrollments);
			if (this._engagements)
				newInstance._engagements = this.duplicateList(this._engagements);
			if (this._periods)
				newInstance._periods = this.duplicateList(this._periods);
		}
		
		return this;
	}
	
	Session.prototype.appendData = function(initialData)
	{
    	this.appendDateRange(initialData);
		
		if (this.registrationDeadline())
			initialData['registration deadline'] = this.registrationDeadline();
		if (this.canRegister())
			initialData['can register'] = this.canRegister();

		this.appendList(this.names(), initialData, 'names');
		this.appendList(this.inquiries(), initialData, 'inquiries');
		this.appendList(this.enrollments(), initialData, 'enrollments');
		this.appendList(this.engagements(), initialData, 'engagements');
		this.appendList(this.periods(), initialData, 'periods');
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Session.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		this.appendDateRangeChanges(revision, changes);

		if (cr.stringChanged(this.registrationDeadline(), revision.registrationDeadline()))
			changes['registration deadline'] = revision.registrationDeadline();
		if (cr.stringChanged(this.canRegister(), revision.canRegister()))
			changes['can register'] = revision.canRegister();
		
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		

		return changes;
	}
	
	/** For a newly updated item, add any new elements created to this. */
	Session.prototype.pullElements = function(source)
	{
		return this.pullNewElements(this.names(), source.names());
	}
	
	Session.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (this.updateDateRange(d, newIDs))
			changed = true;
		
		if (this.updateNames(d, newIDs))
			changed = true;

		if ('registration deadline' in d)
		{
			this._registrationDeadline = d['registration deadline'];
			changed = true;
		}
		if ('can register' in d)
		{
			this._canRegister = d['can register'];
			changed = true;
		}
		if ('inquiries' in d)
		{
			if (this.updateList(this.inquiries, d['inquiries'], newIDs, 'inquiryAdded.cr'))
				changed = true;
		}
		
		if ('enrollments' in d)
		{
			if (this.updateList(this.enrollments, d['enrollments'], newIDs, 'enrollmentAdded.cr'))
				changed = true;
		}
		
		if ('engagements' in d)
		{
			if (this.updateList(this.engagements, d['engagements'], newIDs, 'engagementAdded.cr'))
				changed = true;
		}
		
		if ('periods' in d)
		{
			if (this.updateList(this.periods, d['periods'], newIDs, 'periodAdded.cr'))
				changed = true;
		}
		
		if (changed)
			this.triggerChanged();
		
		return changed;
	}
	
    Session.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['parents', 'periods'];
    	/* Do not get the inquiries, enrollments or engagements, as these may number in the thousands. */
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
	Session.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().sessions(), this);
		$(this.parent()).trigger("sessionDeleted.cr", this);
	}
	
	function Session() {
	    cr.IInstance.call(this);
	};
	
	return Session;

})();
	
cr.SessionName = (function() {
	SessionName.prototype = Object.create(cr.Name.prototype);
	SessionName.prototype.constructor = SessionName;

	SessionName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'session name/{0}'.format(this.id());
	}
	
	function SessionName() {
	    cr.Name.call(this);
	};
	
	return SessionName;

})();
	
cr.Site = (function() {
	Site.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Site.prototype, cr.NamedInstance.prototype);
	Site.prototype.constructor = Site;

	Site.prototype._webSite = null;
	Site.prototype._names = null;
	Site.prototype._offerings = null;
	Site.prototype._address = null;
	Site.prototype._organization = null;
	Site.prototype._dataPromise = null;
	Site.prototype._offeringsPromise = null;

	Site.prototype.webSite = cr.WebSiteInstance.prototype.webSite;
	
	Site.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'site/{0}'.format(this.id());
	}
	
	Site.prototype.offerings = function(newValue)
	{
		if (newValue === undefined)
			return this._offerings;
		else
		{
		    if (newValue != this._offerings)
		    {
				this._offerings = newValue;
			}
			return this;
		}
	}
	
	Site.prototype.address = function(newValue)
	{
		if (newValue === undefined)
			return this._address;
		else
		{
		    if (newValue != this._address)
		    {
				this._address = newValue;
			}
			return this;
		}
	}
	
	Site.prototype.organization = cr.OrganizationLinkInstance.prototype.organization;
	
	/** Sets the data for this Site based on a dictionary of data that
		came from the server.
	 */
	Site.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this.setNames(d, cr.SiteName);
		
		this._webSite = 'web site' in d ? d['web site'] : "";
		if ('address' in d)
		{
			this._address = new cr.Address(this);
			this._address.setData(d['address']);
		}

		this.setChildren(d, 'offerings', cr.Offering, this.offerings);
		cr.OrganizationLinkInstance.prototype.setData.call(this, d);
    }
    
    /** Merge the contents of the specified source into this Site for
    	values that are not specified herein.
     */
	Site.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._webSite) this._webSite = source._webSite;
		if (!this._names && source._names)
			this._names = source._names;
		if (source._address)
		{
			if (!this._address)
			{
				this._address = new cr.Address(this);
			}
			this._address.mergeData(source._address);
		}
		if (!this._offerings && source._offerings)
			this._offerings = source._offerings;
			
		cr.OrganizationLinkInstance.prototype.mergeData.call(this, source);
		return this;
	}
	
	/** For a newly created Site, set its contents to valid values. */
	Site.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._webSite = "";
		this._names = [];
		this._address = new cr.Address(this);
		this._address.setDefaultValues();
		this._offerings = [];
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For sites, offerings are not copied.
	 */
	Site.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		this.duplicateNames(newInstance, duplicateForEdit);
		
		newInstance._webSite = this._webSite;
		if (newInstance._address == null)
		{
			newInstance._address = new cr.Address();
			newInstance._address.parent(newInstance);
		}
			
		if (this._address)
			this._address.duplicateData(newInstance._address, duplicateForEdit);
		else
			newInstance._address.setDefaultValues();
		
		if (duplicateForEdit)
		{
			if (this._offerings)
				newInstance._offerings = this.duplicateList(this._offerings, duplicateForEdit);
		}
		
		return this;
	}
	
	Site.prototype.appendData = function(initialData)
	{
		if (this.webSite())
			initialData['web site'] = this.webSite();
		
		this.appendList(this.names(), initialData, 'names');
		
		if (this.address())
		{
			var addressData = {};
			this.address().appendData(addressData);
			initialData['address'] = addressData;
		}
		
		this.appendList(this.offerings(), initialData, 'offerings');
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	Site.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.stringChanged(this.webSite(), revision.webSite()))
			changes['web site'] = revision.webSite();
		
		var addressChanges = {};
		if (this.address())	
			this.address().appendChanges(revision.address(), addressChanges);
		else if (revision.address())
			revision.address().appendData(addressChanges);
			
		if (Object.keys(addressChanges).length > 0)
		{
			if (this.address())
				addressChanges.id = this.address().id();
			else
			{
				revision.address().clientID(uuid.v4());
				addressChanges.add = revision.address().clientID();
			}
			changes['address'] = addressChanges;
		}
				
		this.appendUpdateList(this.names(), revision.names(), changes, 'names');		
					
		return changes;
	}
	
	/** For a newly updated item, add any new elements created to this. */
	Site.prototype.pullElements = function(source)
	{
		if (!this.address() && source.address())
		{
			this.address(source.address());
			source.address().parent(this);
		}
		
		return this.pullNewElements(this.names(), source.names());
	}
	
	/** Called after the contents of the Site have been updated on the server. */
	Site.prototype.updateData = function(d, newIDs)
	{
		var changed = false;

		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if (this.updateNames(d, newIDs))
			changed = true;
		
		if ('web site' in d)
		{
			this._city = d['web site'];
			changed = true;
		}
		if ('address' in d)
		{
			if (this._address.updateData(d['address'], newIDs))
				changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		if ('offerings' in d)
		{
			if (this.updateList(this.offerings, d['offerings'], newIDs, 'offeringAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
	Site.prototype.promiseData = function(fields)
	{
    	fields = fields !== undefined ? fields : ['address'];
    	var _this = this;
    	return cr.IInstance.prototype.promiseData.call(this, fields)
        	.then(function()
        	{
        		if (_this.address() && 
        			_this.address()._fieldsLoaded.indexOf('this') < 0)
        			_this.address()._fieldsLoaded.push('this');
        		return _this;
        	});
	}
	
	Site.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().sites(), this);
		$(this.parent()).trigger("siteDeleted.cr", this);
	}
	
    Site.prototype.promiseOfferings = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._offeringsPromise)
        	return this._offeringsPromise;
        else if (this._offerings)
        {
        	result = $.Deferred();
        	result.resolve(this._offerings);
        	return result;
        }
        
        var _this = this;	
        this._offeringsPromise = cr.getData(
        	{
        		path: this.urlPath() + "/offering",
        		fields: ['parents', 'services'],
        		resultType: cr.Offering
        	})
        	.then(function(offerings)
        		{
        			_this._offerings = offerings;
        			result = $.Deferred();
        			result.resolve(offerings);
        			return result;
        		});
        return this._offeringsPromise;
    }
    
	function Site() {
	    cr.IInstance.call(this);
	};
	
	return Site;

})();
	
cr.SiteName = (function() {
	SiteName.prototype = Object.create(cr.Name.prototype);
	SiteName.prototype.constructor = SiteName;

	SiteName.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'site name/{0}'.format(this.id());
	}
	
	function SiteName() {
	    cr.Name.call(this);
	};
	
	return SiteName;

})();
	
cr.Street = (function() {
	Street.prototype = Object.create(cr.IInstance.prototype);
	Object.assign(Street.prototype, cr.OrderedInstance.prototype);
	Street.prototype.constructor = Street;

	Street.prototype._position = null;
	Street.prototype._text = null;
	
	Street.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'street/{0}'.format(this.id());
	}
	
	Street.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
		    if (newValue !== this._text)
		    {
				this._text = newValue;
			}
			return this;
		}
	}
	
	/** Sets the data for this street based on a dictionary of data that
		came from the server.
	 */
	Street.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._position = 'position' in d ? d['position'] : "";
		this._text = 'text' in d ? d['text'] : "";
    }
    
    /** Merge the contents of the specified source into this Street for
    	values that are not specified herein.
     */
	Street.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (this._position === null) this._position = source._position;
		if (!this._text) this._text = source._text;
		return this;
	}
	
	/** For a newly created street, set its contents to valid values. */
	Street.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._position = "";
		this._text = "";
	}
	
	Street.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._text = this._text;
		newInstance._position = this._position;
		return this;
	}
	
	Street.prototype.appendData = function(initialData)
	{
		if (this.position() != null)
			initialData.position = this.position();
		if (this.text() != null)
			initialData.text = this.text();
	}
	
	Street.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (this.position() != revision.position())
			changes.position = revision.position();

		if (cr.stringChanged(this.text(), revision.text()))
			changes.text = revision.text();
			
		return changes;
	}
	
	Street.prototype.isEmpty = function()
	{
		return !this.text();
	}
	
	Street.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().streets(), this);
		this.parent().triggerChanged();
		$(this.parent()).trigger("streetDeleted.cr", this);
	}
	
	Street.prototype.calculateDescription = function()
	{
		this._description = this._text;
	}
		
	/** Called after the contents of the Street have been updated on the server. */
	Street.prototype.updateData = function(d, newIDs)
	{
		var changed = false;

		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		if ('text' in d)
		{
			this._text = d['text'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}
	
	function Street() {
	    cr.IInstance.call(this);
	};
	
	return Street;

})();

cr.User = (function() {
	User.prototype = Object.create(cr.PublicGrantable.prototype);
	User.prototype.constructor = User;

	User.prototype._firstName = null;
	User.prototype._lastName = null;
	User.prototype._birthday = null;
	User.prototype._systemAccess = null;
	User.prototype._emails = null;
	User.prototype._notifications = null;
	User.prototype._notificationsPromise = null;
	User.prototype._path = null;
	User.prototype._userGrantRequests = null;
	User.prototype._userGrantRequestsPromise = null;
	User.prototype._tipLevel = null;
	
	User.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user/{0}'.format(this.id());
	}
	
	User.prototype.clear = function()
	{
		cr.PublicGrantable.prototype.clear.call(this);
		this._firstName = null;
		this._lastName = null;
		this._birthday = null;
		this._systemAccess = null;
		this._emails = null;
		this._notifications = null;
		this._notificationsPromise = null;
		this._path = null;
		this._userGrantRequests = null;
		this._userGrantRequestPromise = null;
		this._tipLevel = null;
	}
	
	User.prototype.setDefaultValues = function()
	{
		cr.PublicGrantable.prototype.setDefaultValues.call(this);
		this._firstName = "";
		this._lastName = "";
		this._birthday = "";
		this._systemAccess = "read";
		this._emails = [];
		this._notifications = [];
		this._path = new cr.Path();
		this._path.parent(this);
		this._path.setDefaultValues();
		this._userGrantRequests = [];
		this._tipLevel = null;
	}
	
	User.prototype.setData = function(d)
	{
		cr.PublicGrantable.prototype.setData.call(this, d);
		this._firstName = 'first name' in d ? d['first name'] : "";
		this._lastName = 'last name' in d ? d['last name'] : "";
		this._birthday = 'birthday' in d ? d['birthday'] : "";
		this._systemAccess = 'system access' in d ? d['system access'] : null;
		this._tipLevel = 'tip level' in d ? d['tip level'] : null;
			
		this.setChildren(d, 'emails', cr.UserEmail, this.emails);
		this.setChildren(d, 'notifications', cr.Notification, this.notifications);
		this.setChildren(d, 'user grant requests', cr.UserUserGrantRequest, this.userGrantRequests);
		if ('path' in d)
			this.path(d['path']);
		else
			this._path = null;
			
		/* Clear all of the promises. */
		this._notificationsPromise = null;
		this._userGrantRequestPromise = null;
	}
	
	User.prototype.mergeData = function(source)
	{
		cr.PublicGrantable.prototype.mergeData.call(this, source);
		if (!this._firstName) this._firstName = source._firstName;
		if (!this._lastName) this._lastName = source._lastName;
		if (!this._birthday) this._birthday = source._birthday;
		if (!this._systemAccess) this._systemAccess = source._systemAccess;
		if (!this._tipLevel) this._tipLevel = source._tipLevel;
		if (source._path)
		{
			if (!this._path) 
				this._path = source._path;
			else
				this._path.mergeData(source._path);
		}
		if (!this._emails) this._emails = source._emails;
		if (!this._notifications) this._notifications = source._notifications;
		if (!this._userGrantRequests) this._userGrantRequests = source._userGrantRequests;
		return this;
	}
	
	/* Copies all of the data associated with this instance prior to making changes.
		For experiences, comments are not copied.
	 */
	User.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.PublicGrantable.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		
		newInstance._firstName = this._firstName;
		newInstance._lastName = this._lastName;
		newInstance._birthday = this._birthday;
		newInstance._systemAccess = this._systemAccess;
		newInstance._tipLevel = this._tipLevel;
		
		newInstance._emails = this.duplicateList(this.emails(), duplicateForEdit);
		
		if (newInstance._path == null)
		{
			newInstance._path = new cr.Path();
			newInstance._path.parent(this);
		}
		this._path.duplicateData(newInstance._path, duplicateForEdit);
		
		return this;
	}
	
	/* Appends to initialData all of the operations needed to create a new
		instance.
	 */
	User.prototype.appendData = function(initialData)
	{
		cr.PublicGrantable.prototype.appendData.call(this, initialData);
		if (this.firstName())
			initialData['first name'] = this.firstName();
		if (this.lastName())
			initialData['last name'] = this.lastName();
		if (this.birthday())
			initialData['birthday'] = this.birthday();
		
		if (this.path())
		{
			var pathData = {};
			this.path().appendData(pathData);
			if (Object.keys(pathData).length > 0)
				initialData['path'] = pathData;
		}
		else
		{
			this.path(new cr.Path());
			this.path().setDefaultValues();
		}
		this.appendList(this.emails(), initialData, 'emails');
	}
	
	/* Appends to changes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	User.prototype.appendChanges = function(revision, changes)
	{
		changes = cr.PublicGrantable.prototype.appendChanges.call(this, revision, changes);
		
		if (cr.stringChanged(this.firstName(), revision.firstName()))
			changes['first name'] = revision.firstName();
		if (cr.stringChanged(this.lastName(), revision.lastName()))
			changes['last name'] = revision.lastName();
		if (cr.stringChanged(this.birthday(), revision.birthday()))
			changes['birthday'] = revision.birthday();
			
		var pathChanges = this.path().appendChanges(revision.path());
		if (Object.keys(pathChanges).length > 0)
		{
			pathChanges.id = this.path().id();
			changes['path'] = pathChanges;
		}
				
		return changes;
	}
	
	User.prototype.calculateDescription = function()
	{
		this.description(this.emails().length > 0 ? this.emails()[0].text() : "Unknown User");
	}
	
	User.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		
		if (cr.PublicGrantable.prototype.updateData.call(this, d, newIDs))
			changed = true;
			
		/* Emails are handled separately. */
		
		if ('first name' in d)
		{
			this._firstName = d['first name'];
			changed = true;
		}
		if ('last name' in d)
		{
			this._lastName = d['last name'];
			changed = true;
		}
		if ('birthday' in d)
		{
			this._birthday = d['birthday'];
			this.path().birthday(this._birthday && this._birthday.substr(0, 7));
			changed = true;
		}
		if ('tip level' in d)
		{
			this._tipLevel = d['tip level'];
			changed = true;
		}
		
		if ('path' in d)
		{
			if (this.path().updateData(d['path'], newIDs))
				changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		if ('user grant requests' in d)
		{
			if (this.updateList(this.userGrantRequests, d['user grant requests'], newIDs, 'userGrantRequestAdded.cr'))
				changed = true;
		}
		
		if ('notifications' in d)
		{
			if (this.updateList(this.notifications, d['notifications'], newIDs, 'notificationAdded.cr'))
				changed = true;
		}
		
		return changed;
	}
	
	User.prototype.userGrantType = function()
	{
		return cr.UserUserGrant;
	}
	
	User.prototype.groupGrantType = function()
	{
		return cr.UserGroupGrant;
	}
	
	User.prototype.firstName = function(newValue)
	{
		if (newValue === undefined)
			return this._firstName;
		else
		{
		    if (newValue != this._firstName)
		    {
				this._firstName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.lastName = function(newValue)
	{
		if (newValue === undefined)
			return this._lastName;
		else
		{
		    if (newValue != this._lastName)
		    {
				this._lastName = newValue;
			}
			return this;
		}
	}
	
	User.prototype.fullName = function()
	{
		var firstName = this.firstName();
		var lastName = this.lastName();
		if (firstName)
		{
			if (lastName)
				return firstName + " " + lastName;
			else
				return firstName;
		}
		else 
			return lastName;
	}
	
	User.prototype.caption = function()
	{
		return this.fullName() || this.description();
	}
	
	User.prototype.birthday = function(newValue)
	{
		if (newValue === undefined)
			return this._birthday;
		else
		{
		    if (newValue != this._birthday)
		    {
				this._birthday = newValue;
			}
			return this;
		}
	}
	
	User.prototype.appendUpdateBirthdayCommand = function(newValue, initialData, sourceObjects)
	{
		if (!newValue)
			throw new Error("Your birthday is required.");
		var birthMonth = newValue.substr(0, 7);
		if (birthMonth.length < 7)
			throw new Error("Your birthday must include a year and a month.");
		this.appendUpdateValueCommand(newValue, 
			this.birthday, 'birthday', initialData, sourceObjects);
		
		var subData = {};
		var subSourceObjects = [];
		this.path().appendUpdateValueCommand(birthMonth, 
		    this.path().birthday, 'birthday', subData, subSourceObjects);
		if (subSourceObjects.length > 0)
		{
			if (!('path' in initialData))
				initialData['path'] = {'id': this.path().id()};
			initialData['path']['birthday'] = subData['birthday'];
			for (var i = 0; i < subSourceObjects.length; ++i)
				sourceObjects.push(subSourceObjects[0]);
		}
	}

	User.prototype.name = function()
	{
		var firstName = user.firstName();
		var lastName = user.lastName();
		if (firstName)
		{
			if (lastName)
				return firstName + " " + lastName;
			else
				return firstName;
		}
		else 
			return lastName;
	}
	
	User.prototype.systemAccess = function(newSystemAccess)
	{
		if (newSystemAccess === undefined)
			return this._systemAccess;
		else
		{
			this._systemAccess = newSystemAccess;
			return this;
		}
	}
	
	User.prototype.tipLevel = function(newValue)
	{
		if (newValue === undefined)
			return this._tipLevel;
		else
		{
		    if (newValue != this._tipLevel)
		    {
				this._tipLevel = newValue;
			}
			return this;
		}
	}
	
	User.prototype.path = function(newData)
	{
		if (newData === undefined)
			return this._path;
		else if (newData instanceof cr.Path)
		{
			this._path = newData;
			return this;
		}
		else
		{
			this._path = new cr.Path();
			this._path.setData(newData);
			this._path.parent(this)
					  .user(this);
			this._path = crp.pushInstance(this._path);
			return this;
		}
	}
	
	User.prototype.emails = function(newData)
	{
		if (newData === undefined)
			return this._emails;
		else
		{
			var _this = this;
			this._emails = newData;
			return this;
		}
	}
	
	User.prototype.notifications = function(newData)
	{
		if (newData === undefined)
			return this._notifications;
		else
		{
			var _this = this;
			this._notifications = newData;
			return this;
		}
	}
	
	User.prototype.userGrantRequests = function(newData)
	{
		if (newData === undefined)
			return this._userGrantRequests;
		else
		{
			var _this = this;
			this._userGrantRequests = newData;
			return this;
		}
	}
	
    User.prototype.promiseData = function(fields)
    {
    	fields = fields !== undefined ? fields : ['path'];
    	return cr.IInstance.prototype.promiseData.call(this, fields);
    }
    
    User.prototype.promiseUserGrantRequests = function()
    {
    	p = this.administerCheckPromise();
    	if (p) return p;

        if (this._userGrantRequestsPromise)
        	return this._userGrantRequestsPromise;
        else if (this._userGrantRequests)
        {
        	result = $.Deferred();
        	result.resolve(this._userGrantRequests);
        	return result;
        }
        
        var _this = this;	
        this._userGrantRequestsPromise = cr.getData(
        	{
        		path: this.urlPath() + '/user grant request',
        		fields: [],
        		resultType: cr.UserUserGrantRequest
        	})
        	.then(function(userGrantRequests)
        		{
        			_this._userGrantRequests = userGrantRequests;
        			_this._userGrantRequests.forEach(function(i)
        				{
        					i.user(_this);
        				});
        			result = $.Deferred();
        			result.resolve(userGrantRequests);
        			return result;
        		});
        return this._userGrantRequestsPromise;
    }
    
    User.prototype.promiseNotifications = function()
    {
    	p = this.readCheckPromise();
    	if (p) return p;

        if (this._notificationsPromise)
        	return this._notificationsPromise;
        else if (this._notifications)
        {
        	result = $.Deferred();
        	result.resolve(this._notifications);
        	return result;
        }
        
        var _this = this;	
        this._notificationsPromise = cr.getData(
        	{
        		path: this.urlPath() + '/notification',
        		fields: [],
        		resultType: cr.Notification
        	})
        	.then(function(notifications)
        		{
        			_this._notifications = notifications;
        			result = $.Deferred();
        			result.resolve(notifications);
        			return result;
        		});
        return this._notificationsPromise;
    }
    
    /* Clear the group grants from the user so that they can be subsequently reloaded
    	on demand. This is necessary if the group grants have been updated on the 
    	server but not downloaded to the client.
     */
    User.prototype.clearGroupGrants = function()
    {
    	this._groupGrants = null;
    	cr.removeElement(this._fieldsLoaded, 'group grants');
    }
    
	function User() {
	    cr.PublicGrantable.call(this);
	};
	
	return User;

})();
	
cr.UserEmail = (function() {
	UserEmail.prototype = Object.create(cr.IInstance.prototype);
	UserEmail.prototype.constructor = UserEmail;

	UserEmail.prototype._text = null;
	UserEmail.prototype._position = null;
	
	UserEmail.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user email/{0}'.format(this.id());
	}
	
	UserEmail.prototype.text = function(newValue)
	{
		if (newValue === undefined)
			return this._text;
		else
		{
			if (this._text != newValue)
			{
				this._text = newValue;
			}
			return this;
		}
	}
	
    /** Merge the contents of the specified source into this Street for
    	values that are not specified herein.
     */
	UserEmail.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (this._position === null) this._position = source._position;
		if (!this._text) this._text = source._text;
		return this;
	}
	
	UserEmail.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._text = "";
		this._position = 0;
	}
	
	UserEmail.prototype.setData = function(d)
	{
		this._text = 'text' in d ? d['text'] : "";
		this._position = 'position' in d ? parseInt(d['position']) : 0;
	}
	
	UserEmail.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._text = this._text;
		newInstance._position = this._position;
		return this;
	}
	
	UserEmail.prototype.appendData = function(initialData)
	{
		if (this._position != null)
			initialData.position = this._position;
		if (this.text() != null)
			initialData.text = this.text();
	}
	
	UserEmail.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (this.position() != revision.position())
			changes.position = revision.position();

		if (cr.stringChanged(this.text(), revision.text()))
			changes.text = revision.text();
			
		return changes;
	}
		
	UserEmail.prototype.isEmpty = function()
	{
		return !this.text();
	}
	
	UserEmail.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		cr.removeElement(this.parent().emails(), this);
		$(this.parent()).trigger("emailDeleted.cr", this);
	}
	
	UserEmail.prototype.calculateDescription = function()
	{
		this._description = this._text;
	}
		
	UserEmail.prototype.updateData = function(d, newIDs)
	{
		var changed = false;

		cr.IInstance.prototype.updateData.call(this, d, newIDs);
		if ('position' in d)
		{
			this._position = d['position'];
			changed = true;
		}
		if ('text' in d)
		{
			this._text = d['text'];
			changed = true;
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}
	
	UserEmail.prototype.triggerChanged = function()
	{
		cr.IInstance.prototype.triggerChanged.call(this);
		this.parent().triggerChanged(this);
	}
	
	function UserEmail() {
	    cr.IInstance.call(this);
	};
	
	return UserEmail;

})();
	
cr.UserUserGrant = (function() {
	UserUserGrant.prototype = Object.create(cr.UserGrant.prototype);
	UserUserGrant.prototype.constructor = UserUserGrant;

	UserUserGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user user grant/{0}'.format(this.id());
	}
	
	function UserUserGrant() {
	    cr.UserGrant.call(this);
	};
	
	return UserUserGrant;

})();
	
cr.UserGroupGrant = (function() {
	UserGroupGrant.prototype = Object.create(cr.GroupGrant.prototype);
	UserGroupGrant.prototype.constructor = UserGroupGrant;

	UserGroupGrant.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user group grant/{0}'.format(this.id());
	}
	
	function UserGroupGrant() {
	    cr.GroupGrant.call(this);
	};
	
	return UserGroupGrant;

})();
	
cr.UserUserGrantRequest = (function() {
	UserUserGrantRequest.prototype = Object.create(cr.IInstance.prototype);
	UserUserGrantRequest.prototype.constructor = UserUserGrantRequest;

	UserUserGrantRequest.prototype._user = null;	/* The container for this user grant request */
	UserUserGrantRequest.prototype._grantee = null;
	
	UserUserGrantRequest.prototype.urlPath = function()
	{
		console.assert(this.id());
		return 'user user grant request/{0}'.format(this.id());
	}
	
	UserUserGrantRequest.prototype.grantee = function(newValue)
	{
		if (newValue === undefined)
			return this._grantee;
		else
		{
			var oldID = this._grantee && this._grantee.id();
		    if (newValue.id() != oldID)
		    {
				this._grantee = newValue;
			}
			return this;
		}
	}
	
	UserUserGrantRequest.prototype.user = function(newValue)
	{
		if (newValue === undefined)
			return this._user;
		else
		{
			var oldID = this._user && this._user.id();
		    if (newValue.id() != oldID)
		    {
				this._user = newValue;
			}
			return this;
		}
	}
	
	UserUserGrantRequest.prototype.setData = function(d)
	{
		cr.IInstance.prototype.setData.call(this, d);
		this._grantee = new cr.User();
		this._grantee.setData(d['grantee']);
		this._grantee = crp.pushInstance(this._grantee);
		if ('user' in d)
		{
			this._user = new cr.User();
			this._user.setData(d['user']);
			this._user = crp.pushInstance(this._user);
		}
	}
	
	UserUserGrantRequest.prototype.mergeData = function(source)
	{
		cr.IInstance.prototype.mergeData.call(this, source);
		if (!this._grantee)
			this._grantee = source._grantee;
		return this;
	}
	
	UserUserGrantRequest.prototype.setDefaultValues = function()
	{
		cr.IInstance.prototype.setDefaultValues.call(this);
		this._grantee = null;
	}
	
	UserUserGrantRequest.prototype.duplicateData = function(newInstance, duplicateForEdit)
	{
		cr.IInstance.prototype.duplicateData.call(this, newInstance, duplicateForEdit);
		newInstance._grantee = this._grantee;
		return this;
	}
	
	UserUserGrantRequest.prototype.appendData = function(initialData)
	{
		if (this.grantee())
			initialData['grantee'] = this.grantee().urlPath();
	}
	
	/* Returns a dictionary that describes all of the operations needed to change
		the data in this object to the data in the revision.
	 */
	UserUserGrantRequest.prototype.appendChanges = function(revision, changes)
	{
		changes = changes !== undefined ? changes : {};
		
		if (cr.linkChanged(this.grantee(), revision.grantee()))
			changes.grantee = revision.grantee() && revision.grantee().urlPath();
			
		return changes;
	}
	
	UserUserGrantRequest.prototype.calculateDescription = function()
	{
		this._description = this._grantee ? this._grantee.description() : "";
	}
		
	UserUserGrantRequest.prototype.updateData = function(d, newIDs)
	{
		var changed = false;
		if ('grantee' in d) {
			var granteeData = d['grantee'];
			var granteeID;
			if (typeof(granteeData) == "string")
			{
				if (/\/[A-Za-z0-9]{32}$/.test(granteeData))
					granteeID = granteeData.substring(granteeData.length - 32);
				else
					console.assert(false);
			}
			else if ('id' in granteeData)
				granteeID = granteeData['id'];
			else
				console.assert(false);
				
			var newGrantee = crp.getInstance(granteeID);
			if (this._grantee != newGrantee)
			{
				this._grantee = newGrantee;
				changed = true;
			}
		}
		
		if (changed)
			this.triggerChanged();
			
		return changed;
	}

	UserUserGrantRequest.prototype.triggerDeleted = function()
	{
		cr.IInstance.prototype.triggerDeleted.call(this);
		
		/* Delete from the container first, so that other objects know the container may be empty. */
		var user = this.parent();
		cr.removeElement(user.userGrantRequests(), this);
		$(user).trigger("userGrantRequestDeleted.cr", this);
	}
	
	function UserUserGrantRequest() {
	    cr.IInstance.call(this);
	};
	
	return UserUserGrantRequest;

})();
	
cr.signedinUser = new cr.User();

cr.createSignedinUser = function(id, fields)
{
	fields = fields !== undefined ? fields 
								  : ['path', 'system access', 'user grant requests', 'notifications'];
	crp.clear();
	cr.Service.clearPromises();
	cr.signedinUser.id(id);
	cr.signedinUser = crp.pushInstance(cr.signedinUser);
	
	return cr.signedinUser.promiseData(fields)
		.then(function()
			{
				$(cr.signedinUser).trigger("signin.cr");
				var r2 = $.Deferred();
				r2.resolve(cr.signedinUser);
				return r2;
			});
}

/* Return a new date that will be a UTC date that represents the same date
	as now in the currrent time zone. For example, 10:00 p.m. in Boston on Oct. 21, 2016 should
	be a UTC date of Oct. 21, 2016 even though that time is actually a UTC Date of Oct. 22, 2016.
 */ 
function getUTCTodayDate()
{
	var startMinDate = new Date();
	return new Date(Date.UTC(startMinDate.getFullYear(), startMinDate.getMonth(), startMinDate.getDate(), 0, 0, 0));
}

/* Given an ISO Date string, return a locale date string */
function getLocaleDateString(s)
{
	if (s.length == 4)
		return s;
	else if (s.length == 7)
		return Date.CultureInfo.monthNames[parseInt(s.substr(5)) - 1] + " " + s.substr(0, 4);
	else if (s.length == 10)
	{
		var a = new Date(s);
		
		/* Offset is set to set the time to 1:00 a.m. in the local time zone. Since creating
			a new date sets the time to midnight UTC, we need to set it an hour later in case 
			daylight saving's time is in effect. To account for different time zones, we 
			add an hour if the offset is positive, or subtract an hour if the offset is negative.
		 */
		var offset = (a.getTimezoneOffset()) * 60 * 1000;
		
		if (offset >= 0)
			offset += 60 * 60 * 1000;
		else
			offset -= 60 * 60 * 1000;
			
		a.setTime(a.getTime() + offset);
		return a.toLocaleDateString();
	}
	else
		return s;
}

