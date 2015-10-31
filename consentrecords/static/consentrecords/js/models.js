		/* Add the functionality to a javascript object to attach event targets and
			trigger events on them. This allows events to be fired on model objects.
		 */

var cr = {		
	EventHandler: function () { 
		this.events = {};
	},
	Cell: function() { 
		cr.EventHandler.call(this);
		this.data = [];
	},
	CellValue: function() {
		cr.EventHandler.call(this);
		this.id = null; 
		this.value = null;
		this.cell = null;	/* Initialize the container cell to empty. */
	},
	ObjectValue: function() {
		cr.CellValue.call(this);
		this.value = {id: null, description: "None" };
	},
	dataTypes: {
		_string: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			clearValue: function(d)
			{
				d.value = null;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged.cr", function(e) {
					d.triggerEvent("dataChanged.cr");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_number: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			clearValue: function(d)
			{
				d.value = null;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged.cr", function(e) {
					d.triggerEvent("dataChanged.cr");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_datestamp: {
			isEmpty: function(d)
			{
				return !d.value;
			},
			clearValue: function(d)
			{
				d.value = null;
			},
			setupValue: function(d)
			{
				d.getDescription = function() { return this.value; };
				$(d).on("dataChanged.cr", function(e) {
					d.triggerEvent("dataChanged.cr");
				});
			},
			newValue: function()
			{
				var d = new cr.CellValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.CellValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
					newValue.value = oldValue.value;
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				cr.appendStringData(cell, initialData);
			},
		},
		_object: {
			isEmpty: function(d)
			{
				return !d.value.id && !d.value.cells;
			},
			clearValue: function(d)
			{
				d.value = {id: null, description: "None" };
			},
			setupValue: function(d)
			{
				$(d).on("dataChanged.cr", d.handleContentsChanged);
				$(d).on("valueAdded.cr", d.handleContentsChanged);
				$(d).on("valueDeleted.cr", d.handleContentsChanged);
			},
			newValue: function()
			{
				var d = new cr.ObjectValue();
				this.setupValue(d);
				return d;
			},
			copyValue: function(oldValue)
			{
				var newValue = new cr.ObjectValue();
				this.setupValue(newValue);
				if (oldValue.id !== null && oldValue.id !== undefined)
					newValue.id = oldValue.id;
				if (oldValue.value !== null && oldValue.value !== undefined)
				{
					if (oldValue.value.id)
						newValue.value.id = oldValue.value.id;
					if (oldValue.value.description)
						newValue.value.description = oldValue.value.description;
					if (oldValue.value.cells)
					{
						newValue.value.cells = [];
						$(oldValue.value.cells).each(function()
						{
							newValue.importCell(this);
						});
					}
				}
				return newValue;
			},
			appendData: function(cell, initialData)
			{
				var newData = [];
				if (cell.data)
				{
					for (var i = 0; i < cell.data.length; ++i)
					{
						var d = cell.data[i];
						if (d.getValueID())
						{
							/* This case is true if we are picking an object. */
							var newDatum = {id: null, value: {id: d.getValueID()}};
							newData.push(newDatum);
						}
						else if ("cells" in d.value)
						{
							/* This case is true if we are creating an object */
							var newDatum = {id: null, value: {cells: []}};
							$(d.value.cells).each(function()
							{
								cr.dataTypes[this.field.dataType].appendData(this, newDatum.value.cells);
							});
							
							newData.push(newDatum);
						}
						/* Otherwise, it is blank and shouldn't be saved. */
					}
				}
				initialData.push({"data": newData, "field": cell.field});
			},
		},
	},
	
	urls: {
		selectAll : "/api/selectall/",
		getUserID : "/api/getuserid/",
		getData : "/api/getdata/",
		getConfiguration : "/api/getconfiguration/",
		createInstance : "/api/createinstance/",
		addValue : "/api/addvalue/",
		updateValues : "/api/updatevalues/",
		deleteValue : '/api/deletevalue/',
		deleteInstances : '/api/deleteinstances/',
	},
	
	accessToken: null,
	refreshToken: null,
	tokenType: null,
	
	appendStringData: function(cell, initialData)
	{
		var newData = [];
		$(cell.data).each(function()
			{
				if (this.value)
				{
					var newDatum = {id: null, value: this.value};
					newData.push(newDatum);
				}
			});
		if (newData.length > 0)
			initialData.push({"data": newData, "field": cell.field});
	},
	
	postFailed: function(jqXHR, textStatus, errorThrown, failFunction)
	{
		if (textStatus == "timeout")
			failFunction("This operation ran out of time. Try again.")
		else
			failFunction("Connection error " + errorThrown + ": " + jqXHR.status + "; " + jqXHR.statusText)
	},
	
	selectAll: function (path, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		var argList = {};
		if (path)
			argList.path = path;
		else
			throw "neither path was not specified to selectAll"
		
		$.getJSON(cr.urls.selectAll, 
			argList,
			function(json)
			{
				if (json.success) {
					var newObjects = [];
					$(json.objects).each(function()
					{
						newObjects.push(cr.dataTypes._object.copyValue(this));
					});
					
					if (successFunction)
						successFunction(newObjects);
				}
				else
				{
					if (failFunction)
						failFunction(json.error);
				}
			}
		);
	},
	
	updateObjectValue: function(oldValue, d, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		var initialData = [{id: oldValue.id, value: d.getValueID()}];
		$.post(cr.urls.updateValues, 
				{ commands: JSON.stringify(initialData),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						d.id = json.ids[0]
						oldValue.completeUpdate(d);
						successFunction();
					}
					else {
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
	addObjectValue: function (containerCell, containerUUID, initialData, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.post(cr.urls.addValue, 
				{ containerUUID: containerUUID,
				  elementUUID: containerCell.field.nameID,
				  valueUUID: initialData.getValueID(),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						closealert();
						var newData = cr.dataTypes[containerCell.field.dataType].newValue();
						newData.id = json.id;
						newData.value.description = initialData.getDescription();
						newData.value.id = initialData.getValueID();
						containerCell.addValue(newData);
						successFunction(newData);
					}
					else {
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
	deleteValue: function(oldValue, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
			
		if (oldValue.id == null)	/* It was never saved */
		{
			if (oldValue.cell != null && 
				oldValue.cell.parent == null &&
				oldValue.getValueID() != null)
			{
				/* In this case, oldValue is a root object, so we just need to 
					delete the instance. */
				var jsonArray = { path: "#" + oldValue.getValueID(),
							timezoneoffset: new Date().getTimezoneOffset()
						};
				$.post(cr.urls.deleteInstances, jsonArray)
					.done(function(json, textStatus, jqXHR)
					{
						if (json.success)
						{
							if (successFunction) 
							{
								if (oldValue.cell)
									oldValue.cell.deleteValue(oldValue);
								successFunction(oldValue);
							}
						}
						else
						{
							failFunction(json.error);
						}
					})
					.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					});
			}
			else
			{
				if (oldValue.cell)
					oldValue.cell.deleteValue(oldValue);
				successFunction(oldValue);
			}
		}
		else
		{
			var jsonArray = { valueID: oldValue.id,
						timezoneoffset: new Date().getTimezoneOffset()
					};
			$.post(cr.urls.deleteValue, jsonArray)
				.done(function(json, textStatus, jqXHR)
				{
					if (json.success)
					{
						if (successFunction) 
						{
							if (oldValue.cell)
								oldValue.cell.deleteValue(oldValue);
							successFunction(oldValue);
						}
					}
					else
					{
						failFunction(json.error);
					}
				})
				.fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
				});
		}
	},
			
	createInstance: function(field, containerUUID, initialData, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		var jsonArray = {
					elementUUID: field.nameID,
					typeID: field.ofKindID,
					properties: JSON.stringify(initialData),
					timezoneoffset: new Date().getTimezoneOffset()
				};
		if (containerUUID)
			jsonArray.containerUUID = containerUUID;
	
		$.post(cr.urls.createInstance, 
				jsonArray)
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success)
					{
						if (successFunction) 
						{
							/* Copy the data from json object into newData so that 
								any functions are properly initialized.
							 */
							var newData = cr.dataTypes._object.newValue();
							/* If there is a container, then the id in newData will contain
								the id of the value object in the database. */
							if (containerUUID)
								newData.id = json.object.id;
							newData.value.id = json.object.value.id;
							newData.value.description = json.object.value.description;
							successFunction(newData);
						}
					}
					else
					{
						failFunction(json.error);
					}
				})
			  .fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	},
	
	append: function(oldValue, containerCell, containerUUID, initialData, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (containerCell.parent == null && containerUUID != null)
			throw ("setup error 1 in append");
		else if (containerCell.parent != null && containerCell.parent.getValueID() != containerUUID)
			throw ("setup error 2 in append");
		cr.createInstance(containerCell.field, containerUUID, initialData, 
			function(newData)
			{
				if (oldValue)
					oldValue.completeUpdate(newData);
				else
					containerCell.addValue(newData);
				if (successFunction) successFunction(newData);
			}, 
			failFunction);
	},
	
	updateValues: function(initialData, sourceObjects, updateValuesFunction, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.post(cr.urls.updateValues, 
			{ commands: JSON.stringify(initialData),
			  timezoneoffset: new Date().getTimezoneOffset()
			})
		  .done(function(json, textStatus, jqXHR)
			{
				if (json.success) {
					if ( updateValuesFunction)
						updateValuesFunction();
					for (var i = 0; i < sourceObjects.length; ++i)
					{
						d = sourceObjects[i];
						newID = json.ids[i];
						if (newID)
						{
							d.id = newID;
							d.triggerEvent("dataChanged.cr");
						}
						else
						{
							var cell = d.cell;
							cell.deleteValue(d);
						}
					}
					if (successFunction)
						successFunction();
				}
				else
				{
					if (failFunction)
						failFunction(json.error);
				}
			})
		  .fail(function(jqXHR, textStatus, errorThrown)
				{
					cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
				}
			);
	},
	
	getUserID: function(successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getUserID,
			{"access_token": cr.accessToken,
			 "timezoneoffset": new Date().getTimezoneOffset()},
			function(json)
			{
				if (json.success)
				{
					successFunction(json.userID);
				}
				else
					failFunction(json.error);
			})
		.fail(function(jqXHR, textStatus, errorThrown)
			{
				cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
			}
		);
	},

	getConfiguration: function(parent, typeID, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		$.getJSON(cr.urls.getConfiguration,
			{ "typeID" : typeID }, 
			function(json)
			{
				if (json.success)
				{
					var cells = [];
					$(json.cells).each(function()
					{
						var newCell = new cr.Cell();
						newCell.field = this.field;
						newCell.setup(parent);
						cells.push(newCell);
					});
				
					successFunction(cells);
				}
				else
				{
					failFunction(json.error);
				}
			}
		);
	},
	
	getData: function(path, fields, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (!path)
			throw ("path is not specified");
		
		data = {"path" : path, 
			    "fields" : JSON.stringify(fields) };
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		$.getJSON(cr.urls.getData, data,
			function(json)
			{
				if (json.success) {
					var instances = [];
					for (var i = 0; i < json.data.length; ++i)
					{
						var datum = json.data[i];
						var v = cr.dataTypes._object.newValue();
						v.value.cells = [];
						var cells = datum.cells;
						for (var j = 0; j < cells.length; ++j)
						{
							v.importCell(cells[j]);
						}
						v.value.id = datum.id;
						v.value.parentID = datum.parentID;
						instances.push(v);
					}
				
					successFunction(instances);
				}
				else {
					failFunction(json.error);
				}
			}
		)
		.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, failFunction);
					}
				);
	}
}
		
cr.EventHandler.prototype.addTarget = function(e, target)
{
	if (!target)
		throw "target is not specified";
		
	if (!(e in this.events))
		this.events[e] = [];
	this.events[e].push(target);
}

cr.EventHandler.prototype.removeTarget = function(e, target)
{
	if (!target)
		throw "target is not specified";
		
	if (e in this.events)
	{
		var a = this.events[e]
		a.splice($.inArray(target, a), 1);
	}
}
	
cr.EventHandler.prototype.triggerEvent = function(e, eventInfo)
{
	if (e in this.events)
		$(this.events[e]).trigger(e, eventInfo);
}

cr.EventHandler.prototype.clearEvents = function()
{
	this.events = {};
}
		
cr.Cell.prototype = new cr.EventHandler();
cr.Cell.prototype.setup = function (objectData)
{
	this.parent = objectData;
	if (this.field.descriptorType !== undefined && objectData)
	{
		this.addTarget("valueAdded.cr", objectData);
		this.addTarget("valueDeleted.cr", objectData);
		this.addTarget("dataChanged.cr", objectData);
		$(this).on("dataChanged.cr", function(e) {
			this.triggerEvent("dataChanged.cr");
		});
	}
	
	/* If this is a unique value and there is no value, set up an unspecified one. */
	if (this.data.length == 0 &&
		this.field.capacity == "_unique value") {
		this.pushValue(cr.dataTypes[this.field.dataType].newValue());
	}
};

cr.Cell.prototype.isEmpty = function()
{
	var isEmpty = cr.dataTypes[this.field.dataType].isEmpty;
	for (var i = 0; i < this.data.length; ++i)
	{
		var d = this.data[i];
		if (!isEmpty(d))
			return false;
	}
	return true;
};

cr.Cell.prototype.pushValue = function(newValue)
{
	newValue.cell = this;		
	this.data.push(newValue);
	newValue.addTarget("dataChanged.cr", this);
}
		
cr.Cell.prototype.addValue = function(newData)
{
	var isEmpty = cr.dataTypes[this.field.dataType].isEmpty;
	for (var i = 0; i < this.data.length; ++i)
	{
		var oldData = this.data[i];
		if (!oldData.id && isEmpty(oldData)) {
			oldData.completeUpdate(newData);
			return;
		}
	}
	this.pushValue(newData);
	this.triggerEvent("valueAdded.cr", [newData]);
}

cr.Cell.prototype.addNewValue = function()
{
	var newData = cr.dataTypes[this.field.dataType].newValue();
	this.pushValue(newData);
	this.triggerEvent("valueAdded.cr", [newData]);
	return newData;
}

cr.Cell.prototype.deleteValue = function(oldData)
{
	function remove(arr, item) {
		  for(var i = arr.length; i--;) {
			  if(arr[i] === item) {
				  arr.splice(i, 1);
			  }
		  }
	  }
	if (this.field.capacity == "_unique value")
	{
		oldData.id = null;
		cr.dataTypes[this.field.dataType].clearValue(oldData);
	}
	else
	{
		remove(this.data, oldData);
		oldData.cell = undefined;
  	}
  	oldData.triggerEvent("valueDeleted.cr");
  	this.triggerEvent("valueDeleted.cr", [oldData]);
}

cr.CellValue.prototype = new cr.EventHandler();
cr.CellValue.prototype.completeUpdateValue = function(newData)
{
	/* Replace the value completely so that its cells are eliminated and will be
		re-accessed from the server. This handles the case where a value has been added. */
	this.value = {id: newData.getValueID(), description: newData.getDescription()};
	this.triggerEvent("dataChanged.cr");
}

cr.CellValue.prototype.completeUpdate = function(newData)
{
	this.id = newData.id;
	this.completeUpdateValue(newData);
}

cr.ObjectValue.prototype = new cr.CellValue();
cr.ObjectValue.prototype.getDescription = function() { return this.value.description; };
cr.ObjectValue.prototype.getValueID = function() { return this.value.id; };
cr.ObjectValue.prototype.calculateDescription = function()
{
	if (!("cells" in this.value))
		return this.value.description;
	else
	{
		var nameArray = [];
		for (var i = 0; i < this.value.cells.length; ++i)
		{
			var cell = this.value.cells[i];
			if (cell.field.descriptorType == "_by text")
			{
				cellNames = []
				for (var j = 0; j < cell.data.length; ++j)
				{
					cellNames.push(cell.data[j].getDescription());
				}
				nameArray.push(cellNames.join(separator='/'));
			}
			else if (cell.field.descriptorType == "_by count")
			{
				nameArray.push(cell.data.length.toString());
			}
		}
		if (nameArray.length == 0)
			this.value.description = "None";
		else
			this.value.description = nameArray.join(separator = ' ');
	}
}

cr.ObjectValue.prototype.hasTextDescription = function()
{
	for (var i = 0; i < this.value.cells.length; ++i)
	{
		var cell = this.value.cells[i];
		if (cell.field.descriptorType == "_by text" &&
			cell.data.length > 0)
			return true;
	}
	return false;
}

cr.ObjectValue.prototype.handleContentsChanged = function(e)
{
	var oldDescription = this.getDescription();
	this.calculateDescription();
	if (this.getDescription() != oldDescription)
		this.triggerEvent("dataChanged.cr");
}

cr.ObjectValue.prototype.importCell = function(oldCell)
{
	var newCell = new cr.Cell();
	newCell.field = oldCell.field;
	if (oldCell.data)
	{
		var dt = cr.dataTypes[newCell.field.dataType];
		$(oldCell.data).each(function()
		{
			var newValue = dt.copyValue(this);
			newCell.pushValue(newValue);
		});
	}
	newCell.setup(this);
	this.value.cells.push(newCell);
	return newCell;
}

cr.ObjectValue.prototype.checkCells = function(containerCell, successFunction, failFunction)
{
	if (this.value.cells)
	{
		successFunction();
	}
	else if (this.getValueID())
	{
		var v = this;
		$.getJSON(cr.urls.getData,
			{ "path" : "#" + this.getValueID() }, 
			function(json)
			{
				if (json.success) {
					datum = json.data[0].cells;
					v.value.cells = [];
					for (var i = 0; i < datum.length; ++i)
					{
						v.importCell(datum[i]);
					}
				
					successFunction();
				}
				else {
					failFunction(json.error);
				}
			}
		);
	}
	else if (containerCell.field.ofKindID)
	{
		v = this;
		/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
		cr.getConfiguration(this, containerCell.field.ofKindID, 
			function(newCells)
			{
				v.value.cells = newCells;
				successFunction();
			},
			failFunction);
	}
}
