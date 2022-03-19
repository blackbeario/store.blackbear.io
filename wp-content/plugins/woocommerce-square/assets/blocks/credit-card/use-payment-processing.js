/**
 * External dependencies
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getSquareServerData } from '../square-utils';

/**
 * @typedef {import('../square-utils/type-defs').SquarePaymentFormHandler} SquarePaymentFormHandler
 * @typedef {import('@woocommerce/type-defs/registered-payment-method-props').EmitResponseProps} EmitResponseProps
 * @typedef {import('../square-utils/type-defs').SquareContext} SquareContext
 */

/**
 * Sets up payment details and POST data to be processed on server-side on checkout submission.
 *
 * If the checkout has a nonce, token or data to be logged to WooCommerce Status logs, this function
 * sends a SUCCESS request to the server with this data inside paymentMethodData.
 *
 * If the checkout has errors, we send `has-checkout-errors` to the server-side so that the status
 * of the request can be set to 'ERROR' before gateway validation is done.
 *
 * @param {Function}          onPaymentProcessing  Callback for registering observers on the payment processing event
 * @param {EmitResponseProps} emitResponse         Helpers for observer response objects
 * @param {SquareContext}     squareContext        Square payment form context variable
 * @param {Function}          getPaymentMethodData CreateNonce function
 * @param {Function}          createNonce          CreateNonce function
 * @param {Function}          verifyBuyer          VerifyBuyer function
 */
export const usePaymentProcessing = (
	onPaymentProcessing,
	emitResponse,
	squareContext,
	getPaymentMethodData,
	createNonce,
	verifyBuyer
) => {
	const square = useRef( squareContext );

	useEffect( () => {
		square.current = squareContext;
	}, [ squareContext ] );

	useEffect( () => {
		const processCheckout = async () => {
			const response = { type: emitResponse.responseTypes.SUCCESS };
			const defaults = {
				nonce: '',
				notices: [],
				logs: [],
			};

			const createNonceResponse = await createNonce( square.current );
			const paymentData = { ...defaults, ...createNonceResponse };
			const paymentToken = paymentData.token || paymentData.nonce;

			if ( getSquareServerData().is3dsEnabled && paymentToken ) {
				const verifyBuyerResponse = await verifyBuyer(
					square.current,
					paymentToken
				);

				paymentData.verificationToken =
					verifyBuyerResponse.verificationToken || '';
				paymentData.logs = paymentData.logs.concat(
					verifyBuyerResponse.log || []
				);
				paymentData.errors = paymentData.notices.concat(
					verifyBuyerResponse.errors || []
				);
			}

			if ( paymentToken || paymentData.logs.length > 0 ) {
				response.meta = {
					paymentMethodData: getPaymentMethodData( paymentData ),
				};
			} else if ( paymentData.notices.length > 0 ) {
				response.type = emitResponse.responseTypes.ERROR;
				response.message = paymentData.notices;
			}

			return response;
		};

		const unsubscribe = onPaymentProcessing( processCheckout );
		return unsubscribe;
	}, [
		onPaymentProcessing,
		emitResponse.responseTypes.SUCCESS,
		emitResponse.responseTypes.ERROR,
		createNonce,
		verifyBuyer,
		getPaymentMethodData,
	] );
};
