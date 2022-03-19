/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	CreditCardNumberInput,
	CreditCardExpirationDateInput,
	CreditCardPostalCodeInput,
	CreditCardCVVInput,
} from 'react-square-payment-form';

/**
 * Renders checkout card fields
 *
 * @param {string} cardType Card Type
 */
export const ComponentCardFields = ( { cardType } ) => {
	return (
		<fieldset id="wc-square-credit-card-credit-card-form">
			<span className="sq-label">
				{ __( 'Card Number', 'woocommerce-square' ) }
			</span>
			<div
				id="wc-square-credit-card-account-number-hosted"
				className={ `wc-square-credit-card-hosted-field ${
					cardType ? `card-type-${ cardType }` : ''
				}` }
			>
				<CreditCardNumberInput label={ '' } />
			</div>

			<div className="sq-form-third">
				<span className="sq-label">
					{ __( 'Expiration (MM/YY)', 'woocommerce-square' ) }
				</span>
				<div
					id="wc-square-credit-card-expiry-hosted"
					className="wc-square-credit-card-hosted-field"
				>
					<CreditCardExpirationDateInput label={ '' } />
				</div>
			</div>

			<div className="sq-form-third">
				<span className="sq-label">
					{ __( 'Card Security Code', 'woocommerce-square' ) }
				</span>
				<div
					id="wc-square-credit-card-csc-hosted"
					className="wc-square-credit-card-hosted-field"
				>
					<CreditCardCVVInput label={ '' } />
				</div>
			</div>

			<div className="sq-form-third">
				<span className="sq-label">
					{ __( 'Postal code', 'woocommerce-square' ) }
				</span>
				<div
					id="wc-square-credit-card-postal-code-hosted"
					className="wc-square-credit-card-hosted-field"
				>
					<CreditCardPostalCodeInput label={ '' } />
				</div>
			</div>
		</fieldset>
	);
};
