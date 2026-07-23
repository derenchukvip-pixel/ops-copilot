package dev.artsiom.opscopilot.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class TicketCategoryConverter implements AttributeConverter<TicketCategory, String> {

    @Override
    public String convertToDatabaseColumn(TicketCategory attribute) {
        return attribute == null ? null : attribute.getWireValue();
    }

    @Override
    public TicketCategory convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TicketCategory.fromWireValue(dbData);
    }
}
