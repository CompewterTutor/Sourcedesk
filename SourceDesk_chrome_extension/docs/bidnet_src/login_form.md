```html














<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en" class="public idp-page login-page authentication-page full-screen side-bar-view mobile-friendly">

  	<head>
		<meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="shortcut icon" href="/cms-portals/SSC/images/favicon.ico" />
		<title>BidNet Direct - SSO Login</title>
		<link href="https://fonts.googleapis.com/css?family=Roboto:400,500,300,700" rel="stylesheet" type="text/css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/styles/icons.css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/styles/tags.css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/styles/default.css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/cms-portals/SSC/styles/portal-default.css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/styles/solicitationRedesign.css" />
		<link rel="stylesheet" type="text/css" media="screen" href="/styles/page/authentication/authentication.css" />
		<script type="text/javascript" src="/scripts/jquery/jquery-1.8.2.js"></script>
		<script type="text/javascript" src="/scripts/css-vars-ponyfill.js"></script>
		<script type="text/javascript">
		$(function() {
			//css-vars-ponyfill
			cssVars({
				exclude: 'style,[href*=googleapis],[href*="//"], [href*=portal-layout-1280]'
			});
		});
		</script>

	</head>
  <body>

		
			
	<div id="headerContainer" class="">
		
		<!-- ================================================== -->
		<!--                      Header                        -->
		<!-- ================================================== -->
		<div id="header" class="publicHeader">
						
			<script src="/cms-portals/SSC/scripts/portal-ga-utils.js"></script>
						
			
						<script type="text/javascript">
			    var dataLayer = [];
			    
			    			    if ( typeof(_trackMemberTypeGA) == typeof(Function) ) {
			        _trackMemberTypeGA( "ANONYMOUS" );  
			    } 
			    
			    			    if ( typeof(_mdfga) == typeof(Function) ) {
			        _mdfga();
			    }
			</script>

			
										<!-- Google Tag Manager --><script type="text/javascript">(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'} );var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='//www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-KKJSLC');</script><!-- End Google Tag Manager -->
									
			<div class="information">
                <span>
                    <span class="need-help-phonenumber">
                    <svg id="g_49_tooltip" viewBox="150 200 25 25" style="" class="mets-icon phoneIcon ">
                        <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/images/svg_sprite.svg#phoneIcon"></use></svg>
                    Call Us: 800-835-4603                    </span>
                </span>
			</div>
		</div>
		
		<div id="mainMenu" class="publicMenu noImages hidden-menu">
			<div>
				<ul class="main menu">
					<li class="system-logo">
						<a href="https://www.bidnetdirect.com" class="home">
                                                            <img src="/cms-portals/SSC/images/SystemLogo-en.svg" alt="BidNet Direct" />
                                                    </a>
						
					</li>
											<li class="register-menu-item">
							<a id="registerButtonHeader" href="https://www.bidnetdirect.com/register" class="tab registerButton mets-command-button">Vendor Registration</a>
						</li>
									</ul>
			</div>
		</div>
		
		
	</div>
	
    <!-- ================================================== -->
    <!--                     Content                        -->
    <!-- ================================================== -->
    <div id="content" class=" clear">

			<div class="solWrapper">

		
		<script type = "text/javascript">
			$.ajax({
				url: "https://www.bidnetdirect.com/public/yellow-ai",
				type: "GET",
				data: {
					language: "en"
				}
			})
		</script>
		
	
		<div class="side-bar-view-content">
	
			<div class="content-block basic">
	
				<div class="authentication-block">
					<h1>Login</h1>
					<form id="loginForm" name="loginForm" class="loginForm" action="/profile/SAML2/POST/SSO?execution=e1s1" method="post">
						


<script type="text/javascript">
    $(document).ready(function() {
    	setTimeout(function(){ $("#panelLoginError").removeClass("hidden"); }, 100);
	});
</script>						<fieldset class="accessibility-fieldset">
							<legend>Login</legend>
							<div id="g_11" class="mets-field">
								<label for="j_username" class="mets-field-label">Username</label>
								<div class="mets-field-body">
																			<input id="j_username" name="j_username" type="text" value=""/>
																	</div>
							</div>
							<div id="g_12" class="mets-field">
								<label for="j_password" class="mets-field-label">Password</label>
								<div class="mets-field-body">
									<input type="password" id="j_password" name="j_password" value="" autocomplete="off" />
	
									<a id="passwordRecoveryLink" href="https://www.bidnetdirect.com/public/authentication/password-recovery" title="Forgot your password?" class="mets-command-link">Forgot your password?</a>
								</div>
							</div>
							<div class="button-bar">
								<button id="loginButton" type="submit" title="Login" class="mets-command-button default">Login</button>
								<script type="text/javascript">
									$(function() {
										
										$('#j_username, #j_password').keypress(function(event){
											var keycode = (event.keyCode ? event.keyCode : event.which);
											if(keycode == '13'){
												$("#loginForm").submit();
											}
										});
									});
								</script>
							</div>
							
							<input type="hidden" name="serviceName" value="SSC"></input>
							<input type="hidden" name="_eventId_proceed"></input>
						</fieldset>
					</form>
					<div class="fieldset needhelp">
						<h2>
							<svg id="g_49_tooltip" viewBox="250 100 8 14" class="mets-icon svg-next ">
								<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/images/svg_sprite.svg#next"></use></svg>
							Need Help?						</h2>
						<div class="need-help-content">
							<p>The BidNet Direct Support Department is available Monday-Friday from 8:00 am to 8:00 pm EST.</p>
							<ul>
								<li>
									<svg id="g_49_tooltip" viewBox="150 200 25 25" class="mets-icon phoneIcon ">
										<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/images/svg_sprite.svg#phoneIcon"></use></svg>
									<span class="phoneNumber">800-835-4603</span>
								</li>
								<li>
									<svg id="g_49_tooltip" viewBox="0 200 20 16" class="mets-icon svg-mailIcon ">
										<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/images/svg_sprite.svg#mailIcon"></use></svg>
									 <a href="mailto:support@bidnet.com" title="Click to Mail Contact">support@bidnet.com</a>
								</li>
							</ul>
						</div>
					</div>
					<script type="text/javascript" src="/scripts/page/authentication/login.js"></script>
				</div>


				<div class="no-account-text">
					Don't have an account?&nbsp;
					<a href="https://www.bidnetdirect.com/public/user-registration">Register</a>
				</div>
			</div>
		</div>
	</div>
			
	</div>

	
    
		<!-- ================================================== -->
		<!--                      Footer                        -->
		<!-- ================================================== -->
			<div id="footer" class="">
			    			    
				
				<a href="https://www.bidnetdirect.com/cms-view.jsa?page=%2fcms%2fpublic%2fterms-conditions">Terms &amp; Conditions</a> |
				<a href="https://www.mdfcommerce.com/privacy-policy-en.jsp">Privacy Policy</a> |
				<a href="https://www.bidnetdirect.com/cms-view.jsa?page=%2fcms%2fpublic%2fcontact-us">Contact Us</a>
				
			    <a class="mdfLogo-en" href="http://www.sovra.com/" target="_blank"><span class="accessibility-hidden">SOVRA&nbsp;(opens in a new window)</span></a>
			</div>    
    
		<!-- ================================================== -->
		<!--                      Footer                        -->
		<!-- ================================================== -->
		
		
	


	</body>
</html>

```
