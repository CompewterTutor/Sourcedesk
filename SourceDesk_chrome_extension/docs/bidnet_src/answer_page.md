# Answer Page 
> shows after clicking ellipsis button

##URL: https://www.bidnetdirect.com/private/buyer/solicitations/8679572376/answer-question/8818691421

### question number for validation
```html
<div id="questionNumber" class="mets-field mets-field-view">
		<span class="mets-field-label">
							Question Number</span>
					<div class="mets-field-body ">
			<p>
									Q73</p>
							</div>
	</div>
	```

###	QuestionContainer:
	```html
	<div id="questionContainer_EN">
					<div class="content-block-fieldset-actions">
			<button type="button" id="g_1337" data-href="javascript:;" onclick="if ($(this).data('mets-commandButton').isEnabled()) {editQuestion('EN');}" class="defaultBorderBtn mets-command-button has-icon"> 
		    <svg id="g_1338_tooltip" viewBox="650 600 22 22" style="" class="mets-icon svg-edit " focusable="false" tabindex="-1"><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#editPenSquare"></use></svg>Edit Question</button>		
		
		<!--[if lte IE 9]>
				<script type="text/javascript">
					$(function() {
				   		var linkTag = document.getElementById("g_1337");
				   		if (linkTag){
				   			
					   		linkTag.onclick = function(){
					   			
						   		 if ($(this).data('mets-commandButton').isEnabled()) {
						   		 	editQuestion('EN');
						   		 } 
					   		 };
				   		}
			   		});
		   		</script>
			<![endif]-->
		<script type="text/javascript">
			
			$("#g_1337").commandButton({
				id : "g_1337",
				buttonName : "",
				ajax : "",
				httpVerb : "",
				updateSelector : "",
				buttonType : "button",
				dataMethod : "",
				enabled : "true",
				ajaxFormRegex : "",
				submitForm : "answerQuestionForm",
				disableOnAjaxRequest : true,
				disableOnClick : false,
				targetWindow : "",
				hideAjaxIndicator: false,
				isGlobal: false,
				registerCallbackName: "",
				registerCallbackUrlParameters:"",
				callbackName: "",
				registerCallbackMethod: "GET",
				registerCallbackUrl: "",
				preventDefault: false,
				awsMetricsEventName : "",
				awsMetricsActionPerformed : "",
				awsMetricsAdditionalData : ""
			});
			
			
			
			var button = document.getElementById("g_1337");
			button.addEventListener("keypress", function(event) {
				// If the user presses the "Enter" key on the keyboard
				if (event.key === "Enter") {
				// Cancel the default action, if needed
				event.preventDefault();
				// Trigger the button element with a click
				button.click();
				}
			});
		</script>
			</div>
		
		<div id="g_1339" class="qnaField mets-field mets-field-view">
			<span class="mets-field-label">
								Subject</span>
						<div class="mets-field-body ">
				<p>
				employee conversion policy<input id="answer.workingRevision.localizedInfosMapEN.subject" name="answer.workingRevision.localizedInfosMap[EN].subject" value="employee conversion policy" type="hidden"></p>
		</div>
		</div>
<div class="qnaField mets-field">
			<span class="mets-field-label">
				Question&nbsp;
				<input id="answer.workingRevision.localizedInfosMapEN.questionEdited" name="answer.workingRevision.localizedInfosMap[EN].questionEdited" value="false" type="hidden"></span>
			<div class="mets-field-body">
				<p>
					Is there an employee conversion policy (i.e., can the department directly hire contractor staff after a defined period)?&nbsp;<input id="answer.workingRevision.localizedInfosMapEN.question" name="answer.workingRevision.localizedInfosMap[EN].question" value="Is there an employee conversion policy (i.e., can the department directly hire contractor staff after a defined period)?&nbsp;" type="hidden"></p>
			</div>
		</div>
		
		<input type="hidden" id="editQuestionMode" name="editQuestionMode" value="false">
</div>
```

### FORM:
xpath: `//*[@id="answerQuestionForm"]`

### DROPDOWN FOR ANSWER TYPE: (Private/Public)

```html
<div id="answerType" class="mets-field mandatory-field">
		<label for="answerTypeDropdown" class="mets-field-label ">Answer Type<span class="mets-field-mandatory">*</span></label><div class="mets-field-body">
			<select id="answerTypeDropdown" name="answer.workingRevision.type" onchange="toggleNotificationSpecificationAndPublishDisplay();"><option value="" selected="selected"></option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select></div>
		</div>
```html
<div class="toolbarActions">
				<button type="submit" id="topPublishButton" data-href="/private/buyer/solicitations/8679572376/answer-question/8818691421?target=init-publish" onclick="if ($(this).data('mets-commandButton').isEnabled()) {disableUnsavedChangesWarning();}" class="has-icon" title="Publish"> 
	    <svg id="g_1333_tooltip" viewBox="550 200 18 22" style="" class="mets-icon svg-publish " focusable="false" tabindex="-1"><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#publish"></use></svg><span class="publishButtonLabel">Publish</span>
		</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("topPublishButton");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	disableUnsavedChangesWarning();
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#topPublishButton").commandButton({
			id : "topPublishButton",
			buttonName : "",
			ajax : "true",
			httpVerb : "",
			updateSelector : "",
			buttonType : "submit",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("topPublishButton");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>
		```

QuestionAnswerPanel
Answer TextEdit form element:

cssSelector: `#answerQuestion_answer_input_EN`
xpath: `//*[@id="answerQuestion_answer_input_EN"]`

### Save & Quit Button Bar
```html
<div class="button-bar">
						<a id="g_1342" href="/private/buyer/solicitations/8679572376/answer-question/8818691421/back-to-QnA-list" class="clear-link mets-command-link">Cancel</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1342 = {};
		
		commandLinkOptions_g_1342.id = "g_1342"; 
		commandLinkOptions_g_1342.enabled = "true"; 
		commandLinkOptions_g_1342.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1342.disableOnAjaxRequest = true;
		commandLinkOptions_g_1342.hideAjaxIndicator = false;
		commandLinkOptions_g_1342.isGlobal = false;
		commandLinkOptions_g_1342.disableOnClick = false;
			commandLinkOptions_g_1342.awsMetricsEventName = "";
		commandLinkOptions_g_1342.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1342.awsMetricsAdditionalData = "";
			
			$("#g_1342").commandLink(commandLinkOptions_g_1342);
			</script>
		<button type="submit" id="g_1343" data-href="/private/buyer/solicitations/8679572376/answer-question/8818691421?target=save" onclick="if ($(this).data('mets-commandButton').isEnabled()) {disableUnsavedChangesWarning();}" class="mets-command-button"> 
	    Save &amp; Quit</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("g_1343");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	disableUnsavedChangesWarning();
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#g_1343").commandButton({
			id : "g_1343",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "submit",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("g_1343");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>

---

FULL SOURCE:
```html
<!DOCTYPE html>
<html lang="en" class="SSC private   isBuyingOrg   full-screen side-bar-view javascript-is-loading">
	<head>
	
		<meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
		<link rel="shortcut icon" href="/cms-portals/SSC/images/favicon.ico" />
		<title>RFP_F-0000000075 - Temporary Staffing Services | BidNet Direct</title>
		
		<!-- Google Analytics stuff -->
	    <script type="text/javascript">
    var dataLayer = [];
</script><!-- End of Google Analytics stuff -->
		
	    <meta name="format-detection" content="telephone=no" />	
	    
	    
		<script type="text/javascript" src="/ruxitagentjs_ICANVfhqrux_10335260306043831.js" data-dtconfig="app=85a192578fd729e8|ssc=1|coo=1|owasp=1|featureHash=ICANVfhqrux|rdnt=1|uxrgce=1|cuc=y145fmoq|mel=100000|expw=1|dpvc=1|md=mdcc1=a#session_username@value|lastModification=1776678318171|tp=500,50,0|srbbv=2|agentUri=/ruxitagentjs_ICANVfhqrux_10335260306043831.js|reportUrl=/rb_bf97723bcf|rid=RID_-578516479|rpid=966647944|domain=bidnetdirect.com"></script><link rel="preconnect" href="https://fonts.gstatic.com">
		<link href="https://fonts.googleapis.com/css?family=Roboto:400,500,300,700,900" rel="stylesheet" type="text/css" />
		<link href='https://fonts.googleapis.com/css?family=Work+Sans:400,800,700,600,500,300' rel='stylesheet' type='text/css' />
		<link href="//fonts.googleapis.com/css?family=Open+Sans:400,500,600,700" rel="stylesheet" type="text/css"  />
		<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@300;400;500;600;700&display=swap" rel="stylesheet">
	    
		<link rel="stylesheet" type="text/css" media="all" href="/jawr/css/gzip_1560811191.en@SSC/bundles/default.css" />
<script type="text/javascript" src="/jawr/js/jawr_loader.js" ></script>
		
		<script type="text/javascript" src="/jawr/js/gzip_N4683512/scripts/storage/callback-manager.js" ></script>
<script type="text/javascript">
		
			var contextPath = "";
			var servletPath = "/private/buyer/solicitations/8679572376/answer-question/8818691421";
			var currentLanguage = "EN";
		</script>
		
		<!--[if (gt IE 8) | (!IE)]><!--><script type="text/javascript" src="/jawr/js/gzip_1554131359/scripts/jquery/jquery-3.6.js" ></script>
<!--<![endif]-->
		<!--[if lte IE 8]><script type="text/javascript" src="/jawr/js/gzip_1365487656/scripts/jquery/jquery-1.12.4.js" ></script>
<![endif]-->
		<script type="text/javascript" src="/jawr/js/gzip_N167949007.en/bundles/default.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_699443080.en@SSC/bundles/portal-default.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N195932743/bundles/rx.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N1279689073/scripts/page/common/interceptor/interceptor.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N1093142827/scripts/jquery/plugins/jquery.sticky-kit.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N287490196/bundles/aws.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N1650493820/scripts/aws/aws-metrics.js" ></script>
<script type="text/javascript">
				awsMetrics.initConfig('us-east-1', 
						'us-east-1:0708833b-04a4-4331-9c5f-018f97ed4147',
						'user-sessions-prod-us',
						'f2e1374e633f5b460b1eaa57765aef9799534adc86b41a9f1a3007101a3ccb44',
						'6467454b1326842b29ffb38c5aeda36791c976f08e118736b7f5858ac4c720f0',
						'BUYER',
						'prod',
						'mets',
						'SSC');
				
				awsMetrics.logData('Page Load', 'PAGE_LOAD', );
			</script>
		<script type="text/javascript">
		if ($.ui && $.ui.dialog && $.ui.dialog.prototype._allowInteraction) {
		    var ui_dialog_interaction = $.ui.dialog.prototype._allowInteraction;
		    $.ui.dialog.prototype._allowInteraction = function(e) {
		        if ($(e.target).closest('.select2-dropdown').length || $(e.target).closest('.flatpickr-calendar').length) return true;
		        return ui_dialog_interaction.apply(this, arguments);
		    };
		}
		</script>
		<script type="text/javascript">
			if (typeof(callbackManager) === "undefined"){
				var callbackManager = new CallbackManager();
			}
			callbackManager.setContextPath(contextPath);
			callbackManager.verifyIntegrity("0AB6842A7E9300986430383A76680122.METS");
		
			</script>
		
<meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
<link rel="stylesheet" type="text/css" media="all" href="/jawr/css/gzip_N1250863900/styles/page/private/buyer/solicitations/solicitationRedesign.css" />
<link rel="stylesheet" type="text/css" media="all" href="/jawr/css/gzip_N1484931190/styles/page/private/buyer/solicitations/editSolicitation.css" />
<link rel="stylesheet" type="text/css" media="all" href="/jawr/css/gzip_1419605185/styles/page/private/buyer/solicitations/questionsAnswers.css" />
<script type="text/javascript" src="/jawr/js/gzip_N1978600161/scripts/page/private/buyer/solicitations/questions-answers/answerQuestion.js" ></script>
<script type="text/javascript" src="/jawr/js/gzip_N1724454140/scripts/jquery/plugins/jquery.qtip.js" ></script>


	<link rel="stylesheet" type="text/css" media="only screen and (min-width: 1250px)" href="/jawr/css/gzip_604921578.en@SSC/bundles/layout-1280.css" />
<style id="antiClickjack" type="text/css">body{display:none !important;}</style>
		<script type="text/javascript">
		   if (self === top) {
		       var antiClickjack = document.getElementById("antiClickjack");
		       antiClickjack.parentNode.removeChild(antiClickjack);
		   } else {
		       top.location = self.location;
		   }
		</script>
		<meta name="_csrf" content="0F937CC2172B4D8E77B050AA5B527897D083E3D0F68B2A6A4F11B4A45E93147D4A83DCA28D9AAB195FA85A1609F24228"/>
		<meta name="_csrf_header" content="X-CSRF-TOKEN"/>
		<!-- Google Analytics stuff -->
		<script type="text/javascript">
    if ( typeof(_trackMemberImpersonatorGA) == typeof(Function) ) {
        _trackMemberImpersonatorGA( false, "" );  
    }
    
    

    if ( typeof(_trackMemberDataGA) == typeof(Function) ) {
        _trackMemberDataGA( {"memberType":"Buyer","organizationNumber":"SSC-2569109","contactNumber":"SSC-16020451","membershipType":"FREE","subscriptionItems":[{"displayName":"Buyer Standard FreeMembership","frequency":"STANDARD"}]} );
    }

    
    if ( typeof(_mdfga) == typeof(Function) ) {
    _mdfga();
    }

    </script>
		<!-- End of Google Analytics stuff -->
		
		<link rel="stylesheet" type="text/css" media="all" href="/jawr/css/gzip_1844530057/styles/page/private/buyer/buyer.css" />
<script type="text/javascript" src="/jawr/js/gzip_N661979265/scripts/jquery/plugins/resizeSensor.js" ></script>
</head>
	<body>
		
		<!-- Google Tag Manager --><script type="text/javascript">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'} );var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='//www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KKJSLC');</script><!-- End Google Tag Manager --><div id="ajaxIndicator" class="mets-ajax-indicator">
	Loading...</div>

<div id="ajaxErrorDialog" class="hidden" title="">
		<div  class="mets-dialog-window-content-wrapper">
			<div class="mets-dialog-window-content">
	</div>
	<div class="button-bar center">
		<button type="button" id="buttonAjaxErrorOk" data-href="javascript:;"  onclick="if ($(this).data('mets-commandButton').isEnabled()) {ajaxErrorDialog.close();}" class="defaultBtn mets-command-button"> 
	    Ok</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("buttonAjaxErrorOk");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	ajaxErrorDialog.close();
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#buttonAjaxErrorOk").commandButton({
			id : "buttonAjaxErrorOk",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "button",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("buttonAjaxErrorOk");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>
</div>
	</div>
	
	<div id="closeBtnHtml_ajaxErrorDialog" class="hidden">
		</div>

	<script type="text/javascript">
		
			var ajaxErrorDialog = null;
		
		
			$("#ajaxErrorDialog").dialogWindow({
				width : "auto",
				modal : "true",
				draggable : true,
				alwaysCentered : true,
				showCloseButton: true,
				closeButtonClick: "",
				closeButtonText: "Close",
				closeButtonHtml: $($("#closeBtnHtml_ajaxErrorDialog").html()), /* Grabbing the html this way allows you to put anything for the html and it won't cause errors. */
				extraTitleSelector: "",
				showEffect: "",
				showEffectDuration: 500,
				hideEffect: "",
				hideEffectDuration: 500,
				fixedDialogWindow: true,
				customDialogClass: " higherDialog",
				closeOnEscape: false
			});
			
			ajaxErrorDialog = $("#ajaxErrorDialog").data("mets-dialogWindow");
			</script>
	 
	
	
	<script type="text/javascript">
	$(function() {
		$("#ajaxIndicator").ajaxIndicator({
			debugMode : ""
		});
	});
</script><div class="builderThrobberOverlay">
			<div class="builderOverlay"></div>
			<div id="defaultThrobber" class='uil-default-css builderThrobber' style='transform: scale(0.75);'>
	<div class="spinner one"></div>
	<div class="spinner two"></div>
	<div class="spinner three"></div>
	<div class="spinner four"></div>
	<div class="spinner five"></div>
	<div class="spinner six"></div>
	<div class="spinner seven"></div>
	<div class="spinner eight"></div>
	<div class="spinner nine"></div>
	<div class="spinner ten"></div>
	<div class="spinner eleven"></div>
	<div class="spinner twelve"></div>
</div></div>
		
		<div id="callbackRedirectContainer" class="hidden"></div>
		
		<div id="accessibilitySkipToContent">
			<a href="#content">Skip to main content</a>
		</div>
		
		<!-- Start of Async Drift Code -->

<script>

"use strict";

 

!function() {

  var t = window.driftt = window.drift = window.driftt || [];

  if (!t.init) {

    if (t.invoked) return void (window.console && console.error && console.error("Drift snippet included twice."));

    t.invoked = !0, t.methods = [ "identify", "config", "track", "reset", "debug", "show", "ping", "page", "hide", "off", "on" ],

    t.factory = function(e) {

      return function() {

        var n = Array.prototype.slice.call(arguments);

        return n.unshift(e), t.push(n), t;

      };

    }, t.methods.forEach(function(e) {

      t[e] = t.factory(e);

    }), t.load = function(t) {

      var e = 3e5, n = Math.ceil(new Date() / e) * e, o = document.createElement("script");

      o.type = "text/javascript", o.async = !0, o.crossorigin = "anonymous", o.src = "https://js.driftt.com/include/" + n + "/" + t + ".js";

      var i = document.getElementsByTagName("script")[0];

      i.parentNode.insertBefore(o, i);

    };

  }

}();

drift.SNIPPET_VERSION = '0.3.1';

drift.load('wvfsvetb4uks');

</script>

<!-- End of Async Drift Code -->

<!-- Start of Yellow AI Code -->
<script type = "text/javascript">
    $.ajax({
        url: '/public/yellow-ai',
        type: 'GET'
    })
</script>
<!-- End of Yellow AI Code --><header id="headerContainer" class=" privateMenu">
			<input type="hidden" id="session_username" name="session_username" value="3304742649"/>		









<div class="cmsBlock"><div class="content"></div></div><div id="header" class=" privateHeader buyerHeader ">
</div><div id="mainMenu" class="privateMenu buyerMenu ">
	<div>
		<ul class="main menu">
			<li class="system-logo">
                <a href="/" class="home ">
			        <img src="/private/purchasing-group/8409951/logo/319739311" alt="BidNet Direct" />
			            <span class="accessibility-hidden">Go to homepage</span>
                </a>
            </li>
            
            <li>
            	<div class="mobile-only mobile-burger"><input aria-label="Menu" class="menu-checkbox-toggle" data-mdfga="burgerPublicCheckbox" id="bugerPublicCheckbox" type="checkbox">
					<div class="hamburger">
						<div>&nbsp;</div>
					</div>
				</div>
			   
			   <div class="navContainer">
			   		<div class="navContainerContent">
	   					<nav class="navLinks">
	   						<ul>
								<li>
									    <a href="javascript:;" id="btnSolicitations" class="tab selectable selected"
										   data-target-sub-menu="menuBuyerSolicitations" title="SOLICITATIONS">
										   Solicitations</a>
					                    <ul>
		<li>
	            <a href="/private/buyer/solicitations?target=clear" class="selected"
	                title="Solicitations List">
	                Solicitations List</a>
	        </li>
		<li>
			   <a href="/private/buyer/solicitation-library?target=init" class=""
			       title="Solicitation Library">
			       Solicitation Library</a>
			</li>
		</ul></li>
								<li>
					                    <a href="javascript:;" id="btnVendors" class="tab selectable "
										   data-target-sub-menu="menuVendors" title="VENDORS">
										   Vendors</a>
					                    
										<ul>
		<li>
                   <a href="/private/buyer/vendors/search?target=clear" class=""
                       title="Search">
                       Search</a>
               </li>
		<li>
                   <a href="/private/buyer/vendors-list?target=clear" class=""
                       title="Vendors Lists">
                       Vendors Lists</a>
               </li>
		</ul></li>
								<li>
					                    <a href="javascript:;" id="btnContractsMgmt" class="tab selectable "
										   data-target-sub-menu="menuContractsMgmt" title="CONTRACTS">
										   Contracts</a>
					                    
										<ul>
		<li>
			<a id="g_1372" href="/private/contracts/demo"  title="Contract Management" class="mets-command-link">Contract Management</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1372 = {};
		
		commandLinkOptions_g_1372.id = "g_1372"; 
		commandLinkOptions_g_1372.enabled = "true"; 
		commandLinkOptions_g_1372.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1372.disableOnAjaxRequest = true;
		commandLinkOptions_g_1372.hideAjaxIndicator = false;
		commandLinkOptions_g_1372.isGlobal = false;
		commandLinkOptions_g_1372.disableOnClick = false;
			commandLinkOptions_g_1372.awsMetricsEventName = "";
		commandLinkOptions_g_1372.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1372.awsMetricsAdditionalData = "";
			
			$("#g_1372").commandLink(commandLinkOptions_g_1372);
			</script>
		</li>
		</ul></li>
					            <li>
					                    <a href="javascript:;" id="btnOrganizationTools" class="tab selectable "
										   data-target-sub-menu="menuOrganizationTools" title="TOOLS">
										   Tools</a>
					                    
										<ul>
		<li><a href="/private/buyer/organization-tools/pre-attached-documents"
				class=""
				title="Pre-Attached Documents">
					Pre-Attached Documents</a></li>
		<li><a href="/private/buyer/organization-tools/pre-defined-documents"
				class=""
				title="Bid Document Structure">
					Bid Document Structure</a></li>
		</ul></li>
								<li>
					                    <a href="javascript:;" id="btnReports" class="tab selectable "
					                       data-target-sub-menu="menuReports" title="REPORTS">
					                       Reports</a>
					                    
									    <ul>
		<li><a href="/private/buyer/reports/dashboard"
				class=""
				title="Dashboard">
					Dashboard</a></li>
		<li><a href="/private/buyer/reports/solicitation-dashboard"
				class=""
				title="Solicitation Dashboard">
					Solicitation Dashboard</a></li>
		<li><a href="/private/reports/management"
				class=""
				title="Reports">
					Reports</a></li>
		<li><a href="/private/buyer/reports/bi/portal"
				class=""
				target="_blank"
				title="">
					B.I. Portal<span class="accessibility-hidden">&nbsp;(opens in a new window)</span>
			</a></li>
		</ul></li>
					            <li id="menuRightContainer" class="rightMenu">
					                <a id="helpLink" href="/cms-view.jsa?page=%2fcms%2fprivate%2fbuyer%2fhelp"  title="Help" class="help mets-command-link has-icon" target="_blank"><svg id="helpLink_icon" viewBox="0 0 20 20"  style="" class="mets-icon svg-bem-helpIcon " aria-labelledby="helpLink_icon_title" focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#questionMark" ></use></svg><span class="accessibility-hidden" id="helpLink_icon_title">Help</span><span class="accessibility-hidden">Help</span><span class="accessibility-hidden">&nbsp;(opens in a new window)</span></a>

	<script type="text/javascript">

		var commandLinkOptions_helpLink = {};
		
		commandLinkOptions_helpLink.id = "helpLink"; 
		commandLinkOptions_helpLink.enabled = "true"; 
		commandLinkOptions_helpLink.submitForm = "answerQuestionForm"; 
		commandLinkOptions_helpLink.disableOnAjaxRequest = true;
		commandLinkOptions_helpLink.hideAjaxIndicator = false;
		commandLinkOptions_helpLink.isGlobal = false;
		commandLinkOptions_helpLink.targetWindow = "_blank";
		commandLinkOptions_helpLink.disableOnClick = false;
			commandLinkOptions_helpLink.awsMetricsEventName = "";
		commandLinkOptions_helpLink.awsMetricsActionPerformed = "";
		commandLinkOptions_helpLink.awsMetricsAdditionalData = "";
			
			$("#helpLink").commandLink(commandLinkOptions_helpLink);
			</script>
		<a href="javascript:;" id="myAccountMenuLink" title="My Account" class="myAccount ">
									         <svg id="g_1373_tooltip" viewBox="200 200 18 20"  style="" class="mets-icon avatarIcon " aria-labelledby="g_1373_tooltip_title" focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#avatarIcon" ></use></svg><span class="accessibility-hidden" id="g_1373_tooltip_title">Avatar</span></a>
									     <div id="myAccountMenu" style="display: none;">
											 <a id="g_1374" href="/private/buyer/my-profile"  class="mets-command-link">My Profile</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1374 = {};
		
		commandLinkOptions_g_1374.id = "g_1374"; 
		commandLinkOptions_g_1374.enabled = "true"; 
		commandLinkOptions_g_1374.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1374.disableOnAjaxRequest = true;
		commandLinkOptions_g_1374.hideAjaxIndicator = false;
		commandLinkOptions_g_1374.isGlobal = false;
		commandLinkOptions_g_1374.disableOnClick = false;
			commandLinkOptions_g_1374.awsMetricsEventName = "";
		commandLinkOptions_g_1374.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1374.awsMetricsAdditionalData = "";
			
			$("#g_1374").commandLink(commandLinkOptions_g_1374);
			</script>
		<a id="g_1375" href="/private/buyer/my-organization"  class="mets-command-link">My Organization</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1375 = {};
		
		commandLinkOptions_g_1375.id = "g_1375"; 
		commandLinkOptions_g_1375.enabled = "true"; 
		commandLinkOptions_g_1375.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1375.disableOnAjaxRequest = true;
		commandLinkOptions_g_1375.hideAjaxIndicator = false;
		commandLinkOptions_g_1375.isGlobal = false;
		commandLinkOptions_g_1375.disableOnClick = false;
			commandLinkOptions_g_1375.awsMetricsEventName = "";
		commandLinkOptions_g_1375.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1375.awsMetricsAdditionalData = "";
			
			$("#g_1375").commandLink(commandLinkOptions_g_1375);
			</script>
		<div class="separator" ></div>
 <a id="buyer_logout_link" href="/public/authentication/logout"  class="mets-command-link">Logout</a>

	<script type="text/javascript">

		var commandLinkOptions_buyer_logout_link = {};
		
		commandLinkOptions_buyer_logout_link.id = "buyer_logout_link"; 
		commandLinkOptions_buyer_logout_link.enabled = "true"; 
		commandLinkOptions_buyer_logout_link.submitForm = "answerQuestionForm"; 
		commandLinkOptions_buyer_logout_link.disableOnAjaxRequest = true;
		commandLinkOptions_buyer_logout_link.hideAjaxIndicator = false;
		commandLinkOptions_buyer_logout_link.isGlobal = false;
		commandLinkOptions_buyer_logout_link.disableOnClick = false;
			commandLinkOptions_buyer_logout_link.awsMetricsEventName = "";
		commandLinkOptions_buyer_logout_link.awsMetricsActionPerformed = "";
		commandLinkOptions_buyer_logout_link.awsMetricsAdditionalData = "";
			
			$("#buyer_logout_link").commandLink(commandLinkOptions_buyer_logout_link);
			</script>
		</div>              
									 </li>
			            	</ul>			
						</nav>
            	
			   		</div>
			   </div> 
			   
			   <button type="button" id="menu_mobileAvatarToggle" data-href="javascript:;"  class="mobileAvatarToggle has-icon icon-only" aria-label="My Account"> 
	    <svg id="g_1376_tooltip" viewBox="200 200 18 20"  style="" class="mets-icon svg-menuAvatar " focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#avatarIcon" ></use></svg></button>		
	
	<script type="text/javascript">
		
		$("#menu_mobileAvatarToggle").commandButton({
			id : "menu_mobileAvatarToggle",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "button",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("menu_mobileAvatarToggle");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		<div class="mobileAvatarMenu" style="display: none;">
						<div class="mobileAvatarMenuContent">
							<a id="g_1377" href="/private/buyer/my-profile"  class="mets-command-link">My Profile</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1377 = {};
		
		commandLinkOptions_g_1377.id = "g_1377"; 
		commandLinkOptions_g_1377.enabled = "true"; 
		commandLinkOptions_g_1377.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1377.disableOnAjaxRequest = true;
		commandLinkOptions_g_1377.hideAjaxIndicator = false;
		commandLinkOptions_g_1377.isGlobal = false;
		commandLinkOptions_g_1377.disableOnClick = false;
			commandLinkOptions_g_1377.awsMetricsEventName = "";
		commandLinkOptions_g_1377.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1377.awsMetricsAdditionalData = "";
			
			$("#g_1377").commandLink(commandLinkOptions_g_1377);
			</script>
		<a id="g_1378" href="/private/buyer/my-organization"  class="mets-command-link">My Organization</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1378 = {};
		
		commandLinkOptions_g_1378.id = "g_1378"; 
		commandLinkOptions_g_1378.enabled = "true"; 
		commandLinkOptions_g_1378.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1378.disableOnAjaxRequest = true;
		commandLinkOptions_g_1378.hideAjaxIndicator = false;
		commandLinkOptions_g_1378.isGlobal = false;
		commandLinkOptions_g_1378.disableOnClick = false;
			commandLinkOptions_g_1378.awsMetricsEventName = "";
		commandLinkOptions_g_1378.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1378.awsMetricsAdditionalData = "";
			
			$("#g_1378").commandLink(commandLinkOptions_g_1378);
			</script>
		<div class="separator" ></div>
 <a id="buyer_logout_link_mobile" href="/public/authentication/logout"  class="mets-command-link">Logout</a>

	<script type="text/javascript">

		var commandLinkOptions_buyer_logout_link_mobile = {};
		
		commandLinkOptions_buyer_logout_link_mobile.id = "buyer_logout_link_mobile"; 
		commandLinkOptions_buyer_logout_link_mobile.enabled = "true"; 
		commandLinkOptions_buyer_logout_link_mobile.submitForm = "answerQuestionForm"; 
		commandLinkOptions_buyer_logout_link_mobile.disableOnAjaxRequest = true;
		commandLinkOptions_buyer_logout_link_mobile.hideAjaxIndicator = false;
		commandLinkOptions_buyer_logout_link_mobile.isGlobal = false;
		commandLinkOptions_buyer_logout_link_mobile.disableOnClick = false;
			commandLinkOptions_buyer_logout_link_mobile.awsMetricsEventName = "";
		commandLinkOptions_buyer_logout_link_mobile.awsMetricsActionPerformed = "";
		commandLinkOptions_buyer_logout_link_mobile.awsMetricsAdditionalData = "";
			
			$("#buyer_logout_link_mobile").commandLink(commandLinkOptions_buyer_logout_link_mobile);
			</script>
		</div>
					</div>
				</li>
                    
		</ul>

		<div class="menuOverlay">​</div>
	</div>
    <div class="separator"></div>
        
    <div class="submenus">
		<div id="menuBuyerSolicitations" class="sub clear">
				<ul>
		<li>
	            <a href="/private/buyer/solicitations?target=clear" class="selected"
	                title="Solicitations List">
	                Solicitations List</a>
	        </li>
		<li>
			   <a href="/private/buyer/solicitation-library?target=init" class=""
			       title="Solicitation Library">
			       Solicitation Library</a>
			</li>
		</ul></div>
		<div id="menuVendors" class="sub">
				<ul>
		<li>
                   <a href="/private/buyer/vendors/search?target=clear" class=""
                       title="Search">
                       Search</a>
               </li>
		<li>
                   <a href="/private/buyer/vendors-list?target=clear" class=""
                       title="Vendors Lists">
                       Vendors Lists</a>
               </li>
		</ul></div>
		<div id="menuContractsMgmt" class="sub">
				<ul>
					<li>
						<a id="g_1379" href="/private/contracts/demo"  title="Contract Management" class="mets-command-link">Contract Management</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1379 = {};
		
		commandLinkOptions_g_1379.id = "g_1379"; 
		commandLinkOptions_g_1379.enabled = "true"; 
		commandLinkOptions_g_1379.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1379.disableOnAjaxRequest = true;
		commandLinkOptions_g_1379.hideAjaxIndicator = false;
		commandLinkOptions_g_1379.isGlobal = false;
		commandLinkOptions_g_1379.disableOnClick = false;
			commandLinkOptions_g_1379.awsMetricsEventName = "";
		commandLinkOptions_g_1379.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1379.awsMetricsAdditionalData = "";
			
			$("#g_1379").commandLink(commandLinkOptions_g_1379);
			</script>
		</li>
					</ul></div>
	    <div id="menuOrganizationTools" class="sub">
				<ul>
		<li><a href="/private/buyer/organization-tools/pre-attached-documents"
				class=""
				title="Pre-Attached Documents">
					Pre-Attached Documents</a></li>
		<li><a href="/private/buyer/organization-tools/pre-defined-documents"
				class=""
				title="Bid Document Structure">
					Bid Document Structure</a></li>
		</ul></div>
		<div id="menuReports" class="sub">
	        	<ul>
		<li><a href="/private/buyer/reports/dashboard"
				class=""
				title="Dashboard">
					Dashboard</a></li>
		<li><a href="/private/buyer/reports/solicitation-dashboard"
				class=""
				title="Solicitation Dashboard">
					Solicitation Dashboard</a></li>
		<li><a href="/private/reports/management"
				class=""
				title="Reports">
					Reports</a></li>
		<li><a href="/private/buyer/reports/bi/portal"
				class=""
				target="_blank"
				title="">
					B.I. Portal<span class="accessibility-hidden">&nbsp;(opens in a new window)</span>
			</a></li>
		</ul></div>
	    </div>
</div>



<script type="text/javascript" src="/jawr/js/gzip_N1167093744/scripts/decorators/menu/private/_menuBar.js" ></script>
</header>
		
		<!-- ================================================== -->
		<!--                     Content                        -->
		<!-- ================================================== -->
		<main id="content" class=" clear">
			
	<div id="g_1360"  class="SolicitationToolbar mets-scrollToFixed-topBar ">
        <div class="clearFloat">
	       <div class="toolbarContent clearFloat">
			<div class="toolbarTitle solicitationTitle toolbarTitleSmall">
				<div class="toolbar-breadcrumb">
					</div>
				<h1>
					<span title="RFP_F-0000000075 - Temporary Staffing Services">RFP_F-0000000075 - Temporary Staffing Services</span>
				</h1>
			</div>

			<div class="toolbarActions">
				<button type="submit" id="topPublishButton" data-href="/private/buyer/solicitations/8679572376/answer-question/8818691421?target=init-publish"  onclick="if ($(this).data('mets-commandButton').isEnabled()) {disableUnsavedChangesWarning();}" class="  hidden has-icon" title="Ready for Publication" > 
	    <svg id="g_1361_tooltip" viewBox="550 200 18 22"  style="" class="mets-icon svg-publish " focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#publish" ></use></svg><span class="publishButtonLabel">Ready for Publication</span>
		</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("topPublishButton");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	disableUnsavedChangesWarning();
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#topPublishButton").commandButton({
			id : "topPublishButton",
			buttonName : "",
			ajax : "true",
			httpVerb : "",
			updateSelector : "",
			buttonType : "submit",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("topPublishButton");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>
		</div>
	</div>
	</div>
    <script type="text/javascript">

	    $(document).ready(function() {

		   var scrollPanel_g_1360 = $( "#g_1360" );
		   
			       scrollPanel_g_1360.insertBefore( "#content" ).scrollToFixed({
				       zIndex: 998,
                       spacerClass: "spacer_g_1360",
                   	   marginTop:  function() {
                       	   var marginTop = 0;
                       	   if ($("#mainMenu").hasClass("scroll-to-fixed-fixed")) {
                       		   marginTop = $("#mainMenu").innerHeight();
                       	   }
                       	   
	                       	if ($("#mainMenu").hasClass("scroll-to-fixed-fixed") && scrollPanel_g_1360.hasClass("scroll-to-fixed-fixed")) {
                        	   // the css top property is only actually set on fixed so we'll set it here
                        	   scrollPanel_g_1360.css("top", marginTop);
                    	   }
                       	   return marginTop;
                      } 
			       });
		       
	    });
</script>
<div id="viewBodyContainer">
		<div class="solWrapper">
	
			<div class="side-bar-view-content">
				
				<div class="content-header">
					<h2>Answer a Question</h2>
				</div>
				
				<form id="answerQuestionForm" action="/private/buyer/solicitations/8679572376/answer-question/8818691421" method="post"><div class="content-block">
						<input type="hidden" id="buyerAdded" name="buyerAdded" value="false"  />
						<div class="twoColFields">
							<div id="questionNumber"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Question Number</span>
					<div class="mets-field-body ">
			<p>
									Q73</p>
							</div>
	</div>
<div id="vendorName"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Vendor Name</span>
					<div class="mets-field-body ">
			<p>
									Infojini, Inc.</p>
							</div>
	</div>
<div id="askedBy"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Asked By</span>
					<div class="mets-field-body ">
			<p>
									Sandeep Harjani</p>
							</div>
	</div>
<div id="questionDate"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Question Date</span>
					<div class="mets-field-body ">
			<p>
									04/27/2026 08:51 AM MDT</p>
							</div>
	</div>
<div id="noticeLanguage"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Notice Language</span>
					<div class="mets-field-body ">
			<p>
									English</p>
							</div>
	</div>
<div id="answerType"  class="mets-field mandatory-field">
		<label for="answerTypeDropdown" class="mets-field-label ">Answer Type<span class="mets-field-mandatory">*</span></label><div class="mets-field-body">
			<select id="answerTypeDropdown" name="answer.workingRevision.type" onchange="toggleNotificationSpecificationAndPublishDisplay();"><option value="" selected="selected"></option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select></div>
		</div>
<div id="answerStatus"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Answer Status</span>
					<div class="mets-field-body ">
			<span class="statusCellContainer">
									<span class="statusCell DRAFT">
										Draft</span>
								</span>
							</div>
	</div>
<div id="answerDate"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Answer Date</span>
					<div class="mets-field-body ">
			<p>
									05/06/2026 12:00 AM MDT</p>
							</div>
	</div>
<div id="repliedBy"  class="mets-field mets-field-view">
		<span  class="mets-field-label">
							Replied By</span>
					<div class="mets-field-body ">
			<p>
									Katie Wilson</p>
							</div>
	</div>
</div>
					</div>
					
					<div class="content-block basic">
						<div id="questionAnswerPanelsContainer">
							<div id="questionAnswerPanel_EN"  class="mets-panel expanded toggleable">
		<div  class="mets-panel-header">
		
			<span class="mets-panel-controls">
					<svg id="g_1364_tooltip" viewBox="250 100 8 14"  style="" title="Collapse" class="mets-icon svg-next expanded" aria-labelledby="g_1364_tooltip_title" focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#next" ></use></svg><span class="accessibility-hidden" id="g_1364_tooltip_title">Next</span><input type="hidden" class="expandTooltip" value="Expand" />
						<input type="hidden" class="collapseTooltip" value="Collapse" />
				</span>
			<span class="mets-panel-header-text">
			English - Question/Answer</span>
			<span  class="mets-panel-header-status-text">		
				</span>
			<span  class="mets-panel-header-description-text">		
				</span>
		</div>
	</div>
	<div id="questionAnswerPanel_EN-body"  class="mets-panel-body">
		<div id="questionContainer_EN">
				<div class="content-block-fieldset-actions">
		<button type="button" id="g_1365" data-href="javascript:;"  onclick="if ($(this).data('mets-commandButton').isEnabled()) {editQuestion('EN');}" class="defaultBorderBtn mets-command-button has-icon"> 
	    <svg id="g_1366_tooltip" viewBox="650 600 22 22"  style="" class="mets-icon svg-edit " focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#editPenSquare" ></use></svg>Edit Question</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("g_1365");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	editQuestion('EN');
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#g_1365").commandButton({
			id : "g_1365",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "button",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("g_1365");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>
	
	<div id="g_1367"  class="qnaField mets-field mets-field-view">
		<span  class="mets-field-label">
							Subject</span>
					<div class="mets-field-body ">
			<p>
			employee conversion policy<input id="answer.workingRevision.localizedInfosMapEN.subject" name="answer.workingRevision.localizedInfosMap[EN].subject" value="employee conversion policy" type="hidden" value="employee conversion policy"/></p>
	</div>
	</div>
<div class="qnaField mets-field">
		<span class="mets-field-label">
			Question&nbsp;
			<input id="answer.workingRevision.localizedInfosMapEN.questionEdited" name="answer.workingRevision.localizedInfosMap[EN].questionEdited" value="false" type="hidden" value="false"/></span>
		<div class="mets-field-body">
			<p>
				Is there an employee conversion policy (i.e., can the department directly hire contractor staff after a defined period)? <input id="answer.workingRevision.localizedInfosMapEN.question" name="answer.workingRevision.localizedInfosMap[EN].question" value="Is there an employee conversion policy (i.e., can the department directly hire contractor staff after a defined period)?&nbsp;" type="hidden" value="Is there an employee conversion policy (i.e., can the department directly hire contractor staff after a defined period)?&nbsp;"/></p>
		</div>
	</div>
	
	<input type="hidden" id="editQuestionMode" name="editQuestionMode" value="false" />
</div>
			
		<div data-test-id="answerSection_EN">
			<div id="answerQuestion_answer_field_EN"  class="textareaField mets-field mandatory-field">
		<label for="answerQuestion_answer_input_EN" class="mets-field-label ">Answer<span class="mets-field-mandatory">*</span></label><div class="mets-field-body">
			<textarea id="answerQuestion_answer_input_EN" name="answer.workingRevision.localizedInfosMap[EN].answer" maxlength="2000" showCharCounter="true" rows="6">
</textarea></div>
		</div>
</div>
		</div>
	
	<script type="text/javascript">
		

			$("#questionAnswerPanel_EN").panel({
				toggleable : String("true") == "true",
				toggleCallback : null
			});
			
			
		
		function changeLanguage(languageToChangeTo) {
			alert(languageToChangeTo);
		}
	</script>
</div>
						
						<div id="questionAnswerPanel_internalComment"  class="mets-panel expanded toggleable">
		<div  class="mets-panel-header">
		
			<span class="mets-panel-controls">
					<svg id="g_1368_tooltip" viewBox="250 100 8 14"  style="" title="Collapse" class="mets-icon svg-next expanded" aria-labelledby="g_1368_tooltip_title" focusable="false" tabindex="-1" ><use xlink:href="/jawr/binary/cb3731758341/images/svg_sprite.svg#next" ></use></svg><span class="accessibility-hidden" id="g_1368_tooltip_title">Next</span><input type="hidden" class="expandTooltip" value="Expand" />
						<input type="hidden" class="collapseTooltip" value="Collapse" />
				</span>
			<span class="mets-panel-header-text">
			Internal Comment</span>
			<span  class="mets-panel-header-status-text">		
				</span>
			<span  class="mets-panel-header-description-text">		
				</span>
		</div>
	</div>
	<div id="questionAnswerPanel_internalComment-body"  class="mets-panel-body">
		<div id="g_1369"  class="textareaField mets-field">
		<label for="answer.workingRevision.internalComment" class="mets-field-label ">Comment</label><div class="mets-field-body">
			<textarea id="answer.workingRevision.internalComment" name="answer.workingRevision.internalComment" maxlength="2000" showCharCounter="true" rows="6">
</textarea></div>
		</div>
</div>
	
	<script type="text/javascript">
		

			$("#questionAnswerPanel_internalComment").panel({
				toggleable : String("true") == "true",
				toggleCallback : null
			});
			
			
		
		function changeLanguage(languageToChangeTo) {
			alert(languageToChangeTo);
		}
	</script>
</div>
					<input type="hidden" id="publishQnaModeSetting" value="PRIVATE_INDIVIDUAL_WITH_PUBLIC" />
					<div class="button-bar">
						<a id="g_1370" href="/private/buyer/solicitations/8679572376/answer-question/8818691421/back-to-QnA-list"  class="clear-link mets-command-link">Cancel</a>

	<script type="text/javascript">

		var commandLinkOptions_g_1370 = {};
		
		commandLinkOptions_g_1370.id = "g_1370"; 
		commandLinkOptions_g_1370.enabled = "true"; 
		commandLinkOptions_g_1370.submitForm = "answerQuestionForm"; 
		commandLinkOptions_g_1370.disableOnAjaxRequest = true;
		commandLinkOptions_g_1370.hideAjaxIndicator = false;
		commandLinkOptions_g_1370.isGlobal = false;
		commandLinkOptions_g_1370.disableOnClick = false;
			commandLinkOptions_g_1370.awsMetricsEventName = "";
		commandLinkOptions_g_1370.awsMetricsActionPerformed = "";
		commandLinkOptions_g_1370.awsMetricsAdditionalData = "";
			
			$("#g_1370").commandLink(commandLinkOptions_g_1370);
			</script>
		<button type="submit" id="g_1371" data-href="/private/buyer/solicitations/8679572376/answer-question/8818691421?target=save"  onclick="if ($(this).data('mets-commandButton').isEnabled()) {disableUnsavedChangesWarning();}" class="mets-command-button"> 
	    Save &amp; Quit</button>		
	
	<!--[if lte IE 9]>
			<script type="text/javascript">
				$(function() {
			   		var linkTag = document.getElementById("g_1371");
			   		if (linkTag){
			   			
				   		linkTag.onclick = function(){
				   			
					   		 if ($(this).data('mets-commandButton').isEnabled()) {
					   		 	disableUnsavedChangesWarning();
					   		 } 
				   		 };
			   		}
		   		});
	   		</script>
		<![endif]-->
	<script type="text/javascript">
		
		$("#g_1371").commandButton({
			id : "g_1371",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "submit",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("g_1371");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</div>
			
					<div id="dawActionDialogContainer"></div>
					<div id="dialogContainer"></div>
				<div>
<input type="hidden" name="_csrf" value="0F937CC2172B4D8E77B050AA5B527897D083E3D0F68B2A6A4F11B4A45E93147D4A83DCA28D9AAB195FA85A1609F24228" />
</div></form></div>
		</div>
	</div>
</main>
		
		<div id="errorDialogContainer"></div>
	
		<div id="interceptorDialogContainer"></div>
		
		








<div class="cms-include"> 

















 



<div class="" id="footer"><a href="/tsandcs">Terms & Conditions</a> | <a href="https://www.mdfcommerce.com/privacy-policy-en.jsp" rel="noopener" target="_blank">Privacy Policy</a> | <a href="/cms-view.jsa?page=/cms/public/accessibility-en.jsp">Accessibility</a> <a class="mdfLogo-en" href="https://www.sovra.com" rel="noopener" target="_blank"><span class="accessibility-hidden">Sovra&nbsp;(opens in a new window)</span></a></div>



<script type="application/ld+json">
{ "@context" : "http://schema.org",
  "@type" : "Organization",
  "name" : "BidNet Direct",
  "URL" : "https://www.bidnetdirect.com/",
  "sameAs" : [ 
    "https://www.facebook.com/BidNetDirect/",
    "https://twitter.com/bidnetdirect",
    "https://www.linkedin.com/company/bidnet-direct", 
    "https://plus.google.com/115493283102952285861"
    ] 
}
</script></div><div class="cookie-banner">
			<div class="cookie-banner-content">
				<p>We use cookies and other similar technology to deliver our online services. Essential cookies are used to enable you to access and navigate our site. These are necessary and are always on. We also use functional, analytics, and marketing cookies when we have your consent to do so. For more information on how we use cookies, please consult our <a href="https://www.mdfcommerce.com/privacy-policy-en.jsp" target="_blank">Privacy Policy</a>.</p>
				<span class="cookie-consent-buttons">
					<button type="button" id="cookieBannerAcceptBtn" data-href="javascript:;"  class="mets-command-button"> 
	    Allow all cookies</button>		
	
	<script type="text/javascript">
		
		$("#cookieBannerAcceptBtn").commandButton({
			id : "cookieBannerAcceptBtn",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "button",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("cookieBannerAcceptBtn");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		<button type="button" id="cookieBannerRejectBtn" data-href="javascript:;"  class="rightElement dark defaultBorderBtn mets-command-button"> 
	    Reject all non-essential cookies</button>		
	
	<script type="text/javascript">
		
		$("#cookieBannerRejectBtn").commandButton({
			id : "cookieBannerRejectBtn",
			buttonName : "",
			ajax : "",
			httpVerb : "",
			updateSelector : "",
			buttonType : "button",
			dataMethod : "",
			enabled : "true",
			ajaxFormRegex : "",
			submitForm : "answerQuestionForm",
			disableOnAjaxRequest : true,
			disableOnClick : false,
			targetWindow : "",
			hideAjaxIndicator: false,
			isGlobal: false,
			registerCallbackName: "",
			registerCallbackUrlParameters:"",
			callbackName: "",
			registerCallbackMethod: "GET",
			registerCallbackUrl: "",
			preventDefault: false,
			awsMetricsEventName : "",
			awsMetricsActionPerformed : "",
			awsMetricsAdditionalData : ""
		});
		
		
		
		var button = document.getElementById("cookieBannerRejectBtn");
		button.addEventListener("keypress", function(event) {
			// If the user presses the "Enter" key on the keyboard
			if (event.key === "Enter") {
			// Cancel the default action, if needed
			event.preventDefault();
			// Trigger the button element with a click
			button.click();
			}
		});
	</script>
		</span>
			</div>
		</div>
		
		</body>
</html>

```
