
/* Used to chunk getData operations. */
var GetDataChunker = (function() {
	GetDataChunker.prototype.path = null;
	GetDataChunker.prototype.fields = [];
	GetDataChunker.prototype.increment = 50;
	GetDataChunker.prototype._containerNode = null;
	GetDataChunker.prototype._loadingMessage = null;
	GetDataChunker.prototype._isSpinning = null;
	GetDataChunker.prototype._start = 0;
	GetDataChunker.prototype._inGetData = false;
	GetDataChunker.prototype._onGetDataDone = null;
	GetDataChunker.prototype._check = null;
	
	GetDataChunker.prototype._clearScrollCheck = function()
	{
		if (this._check != null)
		{
			$(this._containerNode).off("scroll", this._check);
			$(window).off("resize", this._check);
			this._check = null;
		}
		this._inGetData = false;
	}
	
	GetDataChunker.prototype.clearLoadingMessage = function()
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._loadingMessage.remove();
			this._loadingMessage = null;
			this._isSpinning = false;
		}
		this._clearScrollCheck();
	}
	
	GetDataChunker.prototype._restart = function(instances, startVal)
	{
		if (this._loadingMessage != null)
		{
			if (instances.length < this.increment)
			{
				this.clearLoadingMessage();
				this._start = 0;
			}
			else
			{
				this._start += this.increment;
				var panelHeight = $(this._containerNode).height();
				var position = $(this._loadingMessage.node()).position();
				if (position.top < panelHeight)
					this._continue(startVal);
				else
					this._inGetData = false;
			}
		}
	}
	
	GetDataChunker.prototype._doneGetData = function(instances, startVal)
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._isSpinning = false;
		}
		this._onGetDataDone(instances, startVal);
		this._restart(instances, startVal);
	}
	
	GetDataChunker.prototype.showLoadingMessage = function()
	{
		if (this._loadingMessage == null)
		{
			this._loadingMessage = crv.appendLoadingMessage(this._containerNode);
			this._isSpinning = true;
		}
		else if (!this._isSpinning)
		{
			crv.startLoadingMessage(this._loadingMessage);
			this._isSpinning = true;
		}
	}
	
	GetDataChunker.prototype._continue = function(startVal)
	{
		var _this = this;
		
		this.showLoadingMessage();

		cr.getData({path: this.path, 
					start: this._start,
					end: this._start + this.increment,
					fields: this.fields, 
					done: function(instances) { _this._doneGetData(instances, startVal); }, 
					fail: asyncFailFunction});
		this._inGetData = true;
	}
	
	GetDataChunker.prototype.start = function(startVal)
	{
		var _this = this;
		
		this._clearScrollCheck();

		this._check = function()
		{
			_this.onScroll(startVal);
		}
		
		$(this._containerNode).scroll(this._check);
		$(window).resize(this._check);
		$(this._containerNode).on("remove", function()
			{
				$(window).off("resize", _this.check);
			});
		this._continue(startVal);
	}
	
	GetDataChunker.prototype.onScroll = function(startVal)
	{
		if (this._loadingMessage != null && !this._inGetData)
		{
			var panelHeight = $(this._containerNode).height();
			var position = $(this._loadingMessage.node()).position();
			if (position.top < panelHeight)
				this._continue(startVal);
		}
	}

	function GetDataChunker(containerNode, onGetDataDone)
	{
		this._containerNode = containerNode;
		this._loadingMessage = null;
		this._isSpinning = false;
		this.path = null;
		this._start = 0;
		this._inGetData = false;
		this._onGetDataDone = onGetDataDone;
		this._check = null;
	}
	
	return GetDataChunker;
})();
