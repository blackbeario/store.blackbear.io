/**
 * External dependencies
 */
import { useState, useCallback, useMemo, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	getSquareServerData,
	handleErrors,
	log,
	logData,
} from '../square-utils';
import { PAYMENT_METHOD_NAME } from './constants';

/**
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').BillingDataProps} BillingDataProps
 * @typedef {import('../square-utils/type-defs').SquarePaymentFormHandler} SquarePaymentFormHandler
 * @typedef {import('../square-utils/type-defs').SquareContext} SquareContext
 */

/**
 * Payment Form Handler
 *
 * @param {BillingDataProps} billing           Checkout billing data.
 * @param {boolean}          shouldSavePayment True if customer has checked box to save card. Defaults to false
 * @param {string}           token             Saved card/token ID passed from server.
 *
 * @return {SquarePaymentFormHandler} An object with properties that interact with the Square Payment Form
 */
export const usePaymentForm = (
	billing,
	shouldSavePayment = false,
	token = null
) => {
	const [ isLoaded, setLoaded ] = useState( false );
	const [ cardType, setCardType ] = useState( '' );
	const resolveCreateNonce = useRef( null );
	const resolveVerifyBuyer = useRef( null );

	const verificationDetails = useMemo( () => {
		const intent = shouldSavePayment && ! token ? 'STORE' : 'CHARGE';
		const newVerificationDetails = {
			billingContact: {
				familyName: billing.billingData.last_name || '',
				givenName: billing.billingData.first_name || '',
				email: billing.billingData.email || '',
				country: billing.billingData.country || '',
				region: billing.billingData.state || '',
				city: billing.billingData.city || '',
				postalCode: billing.billingData.postcode || '',
				phone: billing.billingData.phone || '',
				addressLines: [
					billing.billingData.address_1 || '',
					billing.billingData.address_2 || '',
				],
			},
			intent,
		};

		if ( intent === 'CHARGE' ) {
			newVerificationDetails.amount = (
				billing.cartTotal.value / 100
			).toString();
			newVerificationDetails.currencyCode = billing.currency.code;
		}
		return newVerificationDetails;
	}, [
		billing.billingData,
		billing.cartTotal.value,
		billing.currency.code,
		shouldSavePayment,
		token,
	] );

	const getPaymentMethodData = useCallback(
		( { cardData, nonce, verificationToken, notices, logs } ) => {
			const data = {
				[ `wc-${ PAYMENT_METHOD_NAME }-card-type` ]: cardType || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-last-four` ]:
					cardData?.last_4 || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-exp-month` ]:
					cardData?.exp_month?.toString() || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-exp-year` ]:
					cardData?.exp_year?.toString() || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-payment-postcode` ]:
					cardData?.billing_postal_code || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-payment-nonce` ]: nonce || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-payment-token` ]: token || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-buyer-verification-token` ]:
					verificationToken || '',
				[ `wc-${ PAYMENT_METHOD_NAME }-tokenize-payment-method` ]:
					shouldSavePayment || false,
				'log-data': logs.length > 0 ? JSON.stringify( logs ) : '',
				'checkout-notices':
					notices.length > 0 ? JSON.stringify( notices ) : '',
			};

			return data;
		},
		[ cardType, shouldSavePayment, token ]
	);

	/**
	 * Handles the response from SqPaymentForm.onCreateNonce() and resolves promise
	 *
	 * @param {Array}  errors   Errors thrown by Square when attempting to create a payment nonce with given card details on checkout
	 * @param {string} nonce    Payment nonce created by Square
	 * @param {Object} cardData Validated card data used to create payment nonce
	 */
	const cardNonceResponseReceived = ( errors, nonce, cardData ) => {
		const response = {
			notices: [],
			logs: [],
		};

		if ( errors ) {
			handleErrors( errors, response );
		} else if ( ! nonce ) {
			logData( 'Nonce is missing from the Square response', response );
			log( 'Nonce is missing from the Square response', 'error' );
			handleErrors( [], response );
		} else {
			logData( cardData, response );
			log( 'Card data received' );
			log( cardData );

			response.cardData = cardData;
			response.nonce = nonce;
		}

		if ( resolveCreateNonce.current ) {
			resolveCreateNonce.current( response );
		}
	};

	/**
	 * Generates a payment nonce
	 *
	 * @param {SquareContext} square Instance of SqPaymentForm to call onCreateNonce
	 *
	 * @return {Promise} Returns promise which will be resolved in cardNonceResponseReceived callback
	 */
	const createNonce = useCallback(
		( square ) => {
			if ( ! token ) {
				const promise = new Promise(
					( resolve ) => ( resolveCreateNonce.current = resolve )
				);
				square.onCreateNonce();
				return promise;
			}

			return Promise.resolve( { token } );
		},
		[ token ]
	);

	/**
	 * Generates a verification buyer token
	 *
	 * @param {SquareContext} square       Instance of SqPaymentForm to call onVerifyBuyer
	 * @param {string}        paymentToken Payment Token to verify
	 *
	 * @return {Promise} Returns promise which will be resolved in handleVerifyBuyerResponse callback
	 */
	const verifyBuyer = useCallback(
		( square, paymentToken ) => {
			const promise = new Promise(
				( resolve ) => ( resolveVerifyBuyer.current = resolve )
			);

			square.onVerifyBuyer(
				paymentToken,
				verificationDetails,
				handleVerifyBuyerResponse
			);
			return promise;
		},
		[ verificationDetails, handleVerifyBuyerResponse ]
	);

	/**
	 * Handles the response from SqPaymentForm.onVerifyBuyer() and resolves promise
	 *
	 * @param {Array} errors              Errors thrown by Square when verifying buyer credentials
	 * @param {Object} verificationResult Verify buyer result from Square
	 */
	const handleVerifyBuyerResponse = useCallback(
		( errors, verificationResult ) => {
			const response = {
				notices: [],
				logs: [],
			};

			if ( errors ) {
				for ( const error of errors ) {
					if ( ! error.field ) {
						error.field = 'none';
					}
				}

				handleErrors( errors, response );
			}

			// no errors, but also no verification token.
			if ( ! verificationResult || ! verificationResult.token ) {
				logData(
					'Verification token is missing from the Square response',
					response
				);
				log(
					'Verification token is missing from the Square response',
					'error'
				);
				handleErrors( [], response );
			} else {
				response.verificationToken = verificationResult.token;
			}

			if ( resolveVerifyBuyer.current ) {
				resolveVerifyBuyer.current( response );
			}
		},
		[ resolveVerifyBuyer ]
	);

	/**
	 * When customers interact with the SqPaymentForm iframe elements, determine
	 * whether the cardBrandChanged event has occurred and set card type
	 *
	 * @param {Object} event Input event object
	 */
	const handleInputReceived = useCallback( ( event ) => {
		// change card icon
		if ( event.eventType === 'cardBrandChanged' ) {
			const brand = event.cardBrand;
			let newCardType = 'plain';

			if ( brand === null || brand === 'unknown' ) {
				newCardType = '';
			}

			if ( getSquareServerData().availableCardTypes[ brand ] !== null ) {
				newCardType = getSquareServerData().availableCardTypes[ brand ];
			}

			log( `Card brand changed to ${ brand }` );
			setCardType( newCardType );
		}
	}, [] );

	/**
	 * Returns the postcode value from BillingDataProps or an empty string
	 *
	 * @return {string} Postal Code value or an empty string
	 */
	const getPostalCode = useCallback( () => {
		const postalCode = billing.billingData.postcode || '';
		return postalCode;
	}, [ billing.billingData.postcode ] );

	return {
		cardNonceResponseReceived,
		handleInputReceived,
		isLoaded,
		setLoaded,
		getPostalCode,
		cardType,
		createNonce,
		verifyBuyer,
		getPaymentMethodData,
	};
};
