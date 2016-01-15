		/* Add the functionality to a javascript object to attach event targets and
			trigger events on them. This allows events to be fired on model objects.
		 */

function _setupStringValue(d)
{
	$(d).on("dataChanged.cr", function(e) {
		d.triggerEvent("dataChanged.cr", d);
	});
}

function _newStringValue()
{
	var d = new cr.CellValue();
	this.setupValue(d);
	return d;
}
		
function _copyStringValue(oldValue)
{
	var newValue = new cr.CellValue();
	this.setupValue(newValue);
	if (oldValue.id !== null && oldValue.id !== undefined)
		newValue.id = oldValue.id;
	if (oldValue.value !== null && oldValue.value !== undefined)
		newValue.value = oldValue.value;
	return newValue;
}

function _appendStringCell(cell, initialData)
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
		initialData.push({"field": cell.field, "data": newData});
}

function _appendStringData(cell, initialData)
{
	var newData = [];
	$(cell.data).each(function()
		{
			if (this.value)
			{
				var newDatum = this.value;
				newData.push(newDatum);
			}
		});
	if (newData.length > 0)
		initialData[cell.field.id] = newData;
}
	
function _newTranslationValue()
{
	var d = new cr.TranslationValue();
	this.setupValue(d);
	return d;
}
		
function _copyTranslationValue(oldValue)
{
	var newValue = new cr.TranslationValue();
	this.setupValue(newValue);
	if (oldValue.id !== null && oldValue.id !== undefined)
		newValue.id = oldValue.id;
	if (oldValue.value !== null && oldValue.value !== undefined)
		newValue.value = oldValue.value;
	if (oldValue.languageCode !== null && oldValue.languageCode !== undefined)
		newValue.languageCode = oldValue.languageCode;
	return newValue;
}

function _appendTranslationCell(cell, initialData)
{
	var newData = [];
	$(cell.data).each(function()
		{
			if (this.value)
			{
				var v = {text: this.value};
				if (this.languageCode)
					v.languageCode = this.languageCode;
				var newDatum = {id: null, value: v};
				newData.push(newDatum);
			}
		});
	if (newData.length > 0)
		initialData.push({"field": cell.field, "data": newData});
}

function _appendTranslationData(cell, initialData)
{
	var newData = [];
	$(cell.data).each(function()
		{
			if (this.value)
			{
				var v = this.value;
				newData.push(v);
			}
		});
	if (newData.length > 0)
		initialData[cell.field.id] = newData;
}
var _stringFunctions = {
		isEmpty: function(d) { return !d.value; },
		clearValue: function(d) { d.value = null; },
		setupValue: _setupStringValue,
		newValue: _newStringValue,
		copyValue: _copyStringValue,
		appendCell: _appendStringCell,
		appendData: _appendStringData,
	};
	
var Queue = (function () {

    Queue.prototype.autorun = true;
    Queue.prototype.running = false;
    Queue.prototype.queue = [];

    function Queue(autorun) {
        if (typeof autorun !== "undefined") {
            this.autorun = autorun;
        }
        this.queue = []; //initialize the queue
    };

    Queue.prototype.add = function (callback) {
        var _this = this;
        //add callback to the queue
        this.queue.push(
        	function () {
				var finished = callback();
				if (typeof finished === "undefined" || finished) {
					//  if callback returns `false`, then you have to 
					//  call `next` somewhere in the callback
					_this.dequeue();
				}
        	}
        );

        if (this.autorun && !this.running) {
            // if nothing is running, then start the engines!
            this.dequeue();
        }

        return this; // for chaining fun!
    };

    Queue.prototype.dequeue = function () {
        this.running = false;
        //get the first element off the queue
        var shift = this.queue.shift();
        if (shift) {
            this.running = true;
            shift();
        }
        return shift;
    };

    Queue.prototype.next = Queue.prototype.dequeue;

    return Queue;

})();

var CRP = (function() {
	CRP.prototype.instances = {};	/* keys are ids, values are objects. */
	CRP.prototype.paths = {};
	CRP.prototype.configurations = {};
	CRP.prototype.queue = null;
	
    function CRP() {
    	this.instances = {};
    	this.paths = {};
    	this.configurations = {};
        this.queue = new Queue(true); //initialize the queue
    };
    
    /* Get an instance that has been loaded, or undefined if it hasn't been loaded. */
    CRP.prototype.getInstance = function(id)
    {
    	if (!id)
    		throw("id is not defined");
    	if (id in this.instances)
    		return this.instances[id];
    	else
    		return undefined;
    }

	CRP.prototype.pushID = function(id, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
    	if (!id)
    		throw("id is not defined");
		var _this = this;
		this.queue.add(
			function() {
				if (id in _this.instances) {
					successFunction(_this.instances[id]);
				}
				else
				{
					cr.selectAll({path: "#"+id, 
						done: function(newInstances)
						{
							_this.instances[id] = newInstances[0];
							successFunction(newInstances[0]);
							_this.queue.next();
						}, 
						fail: failFunction} );
					return false;
				}
			});
	};
	
	CRP.prototype.pushCheckCells = function(i, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		if (!i)
			throw "i is not defined";
		var _this = this;
		this.queue.add(
			function() {
				i.checkCells(undefined,
					function() {
						successFunction();
						_this.queue.next();
					},
					failFunction);
				return false;
			});
	};
	
	CRP.prototype.pushInstance = function(i)
	{
		if ("value" in i && "id" in i.value)
		{
			if (!(i.getValueID() in this.instances))
			{
				this.instances[i.getValueID()] = i;
				return i;
			}
			else
			{
				oldInstance = this.instances[i.getValueID()];
				if (!oldInstance.value.cells && i.isDataLoaded)
				{
					oldInstance.value.setCells(i.value.cells);
					oldInstance.isDataLoaded = true;
				}
				return oldInstance;
			}
		}
		else
			return i;	/* This isn't an object. */
	};
	
	/*
		args has the following fields: path, fields, done, fail
	 */
	CRP.prototype.getData = function(args)
	{
		if (typeof(args.done) != "function")
			throw "done is not a function";
		if (typeof(args.fail) != "function")
			throw "fail is not a function";
		if (!args.path)
			throw "path is not defined";
		var _this = this;
		this.queue.add(
			function() {
				if (args.path in _this.paths)
					args.done(_this.paths[args.path]);
				else
				{
					cr.getData({path: args.path, 
								fields: args.fields,
								done: function(newInstances) {
											_this.paths[args.path] = newInstances;
											newInstances.forEach(function(i)
												{ crp.pushInstance(i); });
											args.done(newInstances);
											_this.queue.next();
										}, 
								fail: args.fail});
					return false;
				}
			});
	};
	CRP.prototype.getConfiguration = function(ofKindID, successFunction, failFunction)
	{
		if (typeof(successFunction) != "function")
			throw "successFunction is not a function";
		if (typeof(failFunction) != "function")
			throw "failFunction is not a function";
		var _this = this;
		this.queue.add(
			function() {
				if (ofKindID in _this.configurations)
				{
					successFunction(_this.configurations[ofKindID]);
					return true;
				}
				else
				{
					cr.getConfiguration(null, ofKindID,
						function(cells) {
							_this.configurations[ofKindID] = cells;
							successFunction(cells);
							_this.queue.next();
						}, failFunction);
					return false;
				}
			});
	};
	
	return CRP;
})();

var crp = new CRP();

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
	TranslationValue: function() {
		cr.CellValue.call(this);
		this.value = {text: null, languageCode: null};
	},
	ObjectValue: function() {
		cr.CellValue.call(this);
		this.value = {id: null, description: "None" };
		this.isDataLoaded = false;
	},
	dataTypes: {
		_string: _stringFunctions,
		_number: _stringFunctions,
		_email: _stringFunctions,
		_url: _stringFunctions,
		_telephone: _stringFunctions,
		_datestamp: _stringFunctions,
		"_datestamp (day optional)": _stringFunctions,
		_time: _stringFunctions,
		_translation: {
			isEmpty: function(d) { return !d.value; },
			clearValue: function(d) { d.value = null; d.languageCode = null; },
			setupValue: _setupStringValue,
			newValue: _newTranslationValue,
			copyValue: _copyTranslationValue,
			appendCell: _appendTranslationCell,
			appendData: _appendTranslationData,
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
						newValue.importCells(oldValue.value.cells);
					}
				}
				return newValue;
			},
			appendCell: function(cell, initialData)
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
							d.value.cells.forEach(function(cell)
							{
								cr.dataTypes[cell.field.dataType].appendCell(cell, newDatum.value.cells);
							});
							
							newData.push(newDatum);
						}
						/* Otherwise, it is blank and shouldn't be saved. */
					}
				}
				initialData.push({"field": cell.field, "data": newData});
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
							newData.push(d.getValueID());
						}
						else if ("cells" in d.value)
						{
							/* This case is true if we are creating an object */
							var newDatum = {};
							d.value.cells.forEach(function(cell)
							{
								cr.dataTypes[cell.field.dataType].appendData(cell, newDatum);
							});
							
							newData.push(newDatum);
						}
						/* Otherwise, it is blank and shouldn't be saved. */
					}
				}
				initialData[cell.field.id] = newData;
			},
		},
	},
	
	urls: {
		selectAll : "/api/selectall/",
		getValues : "/api/getvalues/",
		getUserID : "/api/getuserid/",
		getData : "/api/getdata/",
		getConfiguration : "/api/getconfiguration/",
		createInstance : "/api/createinstance/",
		addValue : "/api/addvalue/",
		updateValues : "/api/updatevalues/",
		deleteValue : '/api/deletevalue/',
		deleteInstances : '/api/deleteinstances/',
		checkUnusedEmail : '/user/checkunusedemail/',
		submitSignin: '/submitsignin/',
		submitNewUser: '/submitnewuser/',
	},
	
	accessToken: null,
	refreshToken: null,
	tokenType: null,
	
	postFailed: function(jqXHR, textStatus, errorThrown, failFunction)
	{
		if (textStatus == "timeout")
			failFunction("This operation ran out of time. Try again.")
		else
			failFunction("Connection error " + errorThrown + ": " + jqXHR.status + "; " + jqXHR.statusText)
	},
	
	/* args is an object with up to four parameters: path, limit, done, fail */
	selectAll: function (args)
	{
		if (!args.fail)
			throw ("failFunction is not specified");
		if (!args.done)
			throw ("done function is not specified");
		var argList = {};
		if (args.path)
			argList.path = args.path;
		else
			throw "path was not specified to selectAll"
			
		if (args.limit !== undefined)
			argList.limit = args.limit;
		
		$.getJSON(cr.urls.selectAll, 
			argList,
			function(json)
			{
				if (json.success) {
					var newObjects = [];
					json.objects.forEach(function(v)
					{
						newObjects.push(cr.dataTypes._object.copyValue(v));
					});
					
					if (args.done)
						args.done(newObjects);
				}
				else
				{
					if (args.fail)
						args.fail(json.error);
				}
			}
		);
	},
	
	/* args is an object with up to four parameters: path, limit, done, fail */
	getValues: function (args)
	{
		if (!args.fail)
			throw ("failFunction is not specified");
		if (!args.done)
			throw ("done function is not specified");
		var argList = {};
		if (args.path)
			argList.path = args.path;
		else
			throw "path was not specified to getValues"
			
		if (args.field)
			argList.elementUUID = args.field.nameID;
		else
			throw "field was not specified to getValues"
			
		if (args.value)
			argList.value = args.value;
		else
			throw "value was not specified to getValues"
			
		if (args.limit !== undefined)
			argList.limit = args.limit;
		
		$.getJSON(cr.urls.getValues, 
			argList,
			function(json)
			{
				if (json.success) {
					var newObjects = [];
					json.objects.forEach(function(v)
					{
						newObjects.push(cr.dataTypes._object.copyValue(v));
					});
					
					if (args.done)
						args.done(newObjects);
				}
				else
				{
					if (args.fail)
						args.fail(json.error);
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
		/* oldValue must be an object value */
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
					properties: JSON.stringify(initialData),
					timezoneoffset: new Date().getTimezoneOffset()
				};
		if (field.nameID)
			jsonArray.elementUUID = field.nameID;
		else if (field.name)
			jsonArray.elementName = field.name;
		else
			throw ("neither field name nor field name ID is specified");
			
		if (field.ofKindID)
			jsonArray.typeID = field.ofKindID;
		else if (field.ofKind)
			jsonArray.typeName = field.ofKind;
		else
			throw ("neither field.ofKindID nor field.ofKind is specified");
			
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
		if (!oldValue)
			throw "oldValue is not specified";
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (containerCell.parent == null && containerUUID != null)
			throw ("setup error 1 in append");
		else if (containerCell.parent != null && containerCell.parent.getValueID() != containerUUID)
			throw ("setup error 2 in append");
		/* oldValue must be an ObjectValue */
		cr.createInstance(containerCell.field, containerUUID, initialData, 
			function(newData)
			{
				oldValue.completeUpdate(newData);
				oldValue.isDataLoaded = true;
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
							d.triggerEvent("dataChanged.cr", d);
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
					json.cells.forEach(function(cell)
					{
						var newCell = new cr.Cell();
						newCell.field = cell.field;
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
	
	/*
		args is an object with up to four parameters: path, fields, done, fail
	 */
	getData: function(args)
	{
		if (!args.fail)
			throw ("failFunction is not specified");
		if (!args.done)
			throw ("successFunction is not specified");
		if (!args.path)
			throw ("path is not specified");
		
		var data = {path : args.path}
		if (args.fields)
			data['fields'] = JSON.stringify(args.fields); 
		if (cr.accessToken)
			data["access_token"] = cr.accessToken;
				  
		if (args.limit !== undefined)
			data.limit = args.limit;
		
		$.getJSON(cr.urls.getData, data,
			function(json)
			{
				if (json.success) {
					var instances = [];
					for (var i = 0; i < json.data.length; ++i)
					{
						var datum = json.data[i];
						var v = cr.dataTypes._object.newValue();
						v.importCells(datum.cells);
						v.value.id = datum.id;
						v.value.description = datum.description;
						v.value.parentID = datum.parentID;
						v.isDataLoaded = true;
						instances.push(v);
					}
				
					args.done(instances);
				}
				else {
					args.fail(json.error);
				}
			}
		)
		.fail(function(jqXHR, textStatus, errorThrown)
					{
						cr.postFailed(jqXHR, textStatus, errorThrown, args.fail);
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
	$(this).off("dataChanged.cr");
}
		
cr.Cell.prototype = new cr.EventHandler();

cr.Cell.prototype.setParent = function (parent)
{
	this.parent = parent;
	if (this.field.descriptorType !== undefined && parent)
	{
		this.addTarget("valueAdded.cr", parent);
		this.addTarget("valueDeleted.cr", parent);
		this.addTarget("dataChanged.cr", parent);
		$(this).on("dataChanged.cr", function(e) {
			this.triggerEvent("dataChanged.cr", this);
		});
	}
};

cr.Cell.prototype.setup = function (objectData)
{
	this.setParent(objectData);
	
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
	if (this.field.dataType != "_object")
		throw "addValue only callable for object dataType cells";
		
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

/* The success function takes a single argument: the new value being created. */
cr.Cell.prototype.addObjectValue = function(initialData, successFunction, failFunction)
	{
		if (!failFunction)
			throw ("failFunction is not specified");
		if (!successFunction)
			throw ("successFunction is not specified");
		if (!this.parent.getValueID())
			throw("cell parent does not have an ID")
		var _this = this;
		$.post(cr.urls.addValue, 
				{ containerUUID: this.parent.getValueID(),
				  elementUUID: this.field.nameID,
				  valueUUID: initialData.getValueID(),
				  timezoneoffset: new Date().getTimezoneOffset()
				})
			  .done(function(json, textStatus, jqXHR)
				{
					if (json.success) {
						closealert();
						var newData = cr.dataTypes[_this.field.dataType].newValue();
						newData.id = json.id;
						newData.value.description = initialData.getDescription();
						newData.value.id = initialData.getValueID();
						_this.addValue(newData);
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
	
cr.CellValue.prototype = new cr.EventHandler();
cr.CellValue.prototype.getDescription = function() { return this.value; };
cr.CellValue.prototype.completeUpdate = function(newData)
{
	this.id = newData.id;
	this.completeUpdateValue(newData);
}

cr.TranslationValue.prototype = new cr.CellValue();
cr.TranslationValue.prototype.getDescription = function() { return this.value.text; };

cr.ObjectValue.prototype = new cr.CellValue();
cr.ObjectValue.prototype.getDescription = function() { return this.value.description; };
cr.ObjectValue.prototype.getValueID = function() { return this.value.id; };
cr.ObjectValue.prototype.completeUpdateValue = function(newData)
{
	/* Replace the value completely so that its cells are eliminated and will be
		re-accessed from the server. This handles the case where a value has been added. */
	this.value = {id: newData.getValueID(), description: newData.getDescription()};
	this.triggerEvent("dataChanged.cr", this);
}

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
				var cellNames = [];
				var dt = cr.dataTypes[cell.field.dataType];
				for (var j = 0; j < cell.data.length; ++j)
				{
					if (!dt.isEmpty(cell.data[j]))
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

cr.ObjectValue.prototype.getCell = function(name)
{
	for (var i = 0; i < this.value.cells.length; ++i)
	{
		var cell = this.value.cells[i];
		if (cell.field.name == name)
			return cell;
	}
	return undefined;
}

cr.ObjectValue.prototype.getDatum = function(name)
{
	var cell = this.getCell(name);
	return cell && cell.data.length && cell.data[0].value;
}
		
cr.ObjectValue.prototype.getValue = function(name)
{
	var cell = this.getCell(name);
	return cell && cell.data.length && cell.data[0];
}
		
cr.ObjectValue.prototype.handleContentsChanged = function(e)
{
	var oldDescription = this.getDescription();
	this.calculateDescription();
	if (this.getDescription() != oldDescription)
		this.triggerEvent("dataChanged.cr", this);
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

cr.ObjectValue.prototype.importCells = function(oldCells)
{
	this.value.cells = [];
	for (var j = 0; j < oldCells.length; ++j)
	{
		this.importCell(oldCells[j]);
	}
}

cr.ObjectValue.prototype.setCells = function(oldCells)
{
	if (this.value.cells)
	{
		for (var j = 0; j < this.value.cells.length; ++j)
		{
			this.value.cells[j].clearEvents();
		}
	}
		
	this.value.cells = oldCells;
	for (var j = 0; j < oldCells.length; ++j)
	{
		oldCells[j].clearEvents();
		oldCells[j].setParent(this);
	}
}

cr.ObjectValue.prototype.checkCells = function(fields, successFunction, failFunction)
{
	if (typeof(successFunction) != "function")
		throw "successFunction is not a function";
	if (typeof(failFunction) != "function")
		throw "failFunction is not a function";
	
	if (this.value.cells && this.isDataLoaded)
	{
		successFunction();
	}
	else if (this.getValueID())
	{
		var _this = this;
		var jsonArray = { "path" : "#" + this.getValueID() };
		if (fields)
			jsonArray["fields"] = JSON.stringify(fields);
		$.getJSON(cr.urls.getData,
			jsonArray, 
			function(json)
			{
				if (json.success) {
					_this.importCells(json.data[0].cells);
					_this.isDataLoaded = true;
					successFunction();
				}
				else {
					failFunction(json.error);
				}
			}
		);
	}
	else if (this.cell.field.ofKindID)
	{
		var _this = this;
		/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
		cr.getConfiguration(this, this.cell.field.ofKindID, 
			function(newCells)
			{
				_this.value.cells = newCells;
				successFunction();
			},
			failFunction);
	}
}

cr.ObjectValue.prototype.checkConfiguration = function(successFunction, failFunction)
{
	if (!failFunction)
		throw ("failFunction is not specified");
	if (!successFunction)
		throw ("successFunction is not specified");
	if (!this.cell)
		throw "cell is not specified for this object";
		
	if (this.value.cells)
	{
		successFunction();
	}
	else
	{
		var _this = this;
		/* This is a blank item. This can be a unique item that hasn't yet been initialized. */
		cr.getConfiguration(this, this.cell.field.ofKindID, 
			function(newCells)
			{
				_this.value.cells = newCells;
				successFunction();
			},
			failFunction);
	}
}